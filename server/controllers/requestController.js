const qrcode = require('qrcode');
const pool = require('../config/db');
const { getDistance } = require('../utils/haversine');
const { getCompatibleDonors, getDonationTargets } = require('../utils/compatibility');

const DONATION_COOLDOWN_DAYS = 112;
const DONOR_RADIUS_KM = 10;

const expireOldRequests = async () => {
    await pool.query(`
        UPDATE BloodRequests
        SET request_status = 'Cancelled', approved_donor_id = NULL
        WHERE request_status IN ('Created', 'Searching Donor', 'Primary Donor Assigned')
        AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
};

exports.getDashboardRequests = async (req, res) => {
    try {
        await expireOldRequests();

        const [[donorProfile]] = await pool.query(
            `SELECT u.blood_group, u.latitude, u.longitude, u.donation_count, u.last_donation_date,
                h.eligibility_status
             FROM Users u
             LEFT JOIN HealthInfo h ON u.id = h.user_id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (!donorProfile) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const donationTargets = getDonationTargets(donorProfile.blood_group);
        let donateRequests = [];

        if (donationTargets.length > 0) {
            const [rows] = await pool.query(`
                SELECT br.*, u.name AS hospital_name,
                    EXISTS (
                        SELECT 1 FROM BackupDonors bd
                        WHERE bd.request_id = br.id AND bd.donor_id = ?
                    ) AS has_joined
                FROM BloodRequests br
                JOIN Users u ON u.id = br.hospital_id
                WHERE br.request_status IN ('Created', 'Searching Donor', 'Primary Donor Assigned', 'Donation In Progress')
                AND br.blood_group_required IN (?)
                AND br.hospital_id <> ?
                ORDER BY br.created_at DESC
            `, [req.user.id, donationTargets, req.user.id]);

            donateRequests = rows.map((request) => {
                const distance = getDistance(
                    donorProfile.latitude,
                    donorProfile.longitude,
                    request.latitude,
                    request.longitude
                );

                return {
                    ...request,
                    distance,
                    has_joined: Boolean(request.has_joined),
                };
            }).filter((request) => {
                if (request.distance > DONOR_RADIUS_KM) return false;
                if (!donorProfile.last_donation_date) return true;
                const daysSince = Math.floor((new Date() - new Date(donorProfile.last_donation_date)) / (1000 * 60 * 60 * 24));
                return daysSince >= DONATION_COOLDOWN_DAYS;
            }).sort((a, b) => a.distance - b.distance);
        }

        const [myRequestRows] = await pool.query(`
            SELECT br.*,
                COUNT(bd.id) AS donor_responses,
                MIN(bd.rank_order) AS best_rank
            FROM BloodRequests br
            LEFT JOIN BackupDonors bd ON br.id = bd.request_id
            WHERE br.hospital_id = ?
            AND br.request_status NOT IN ('Completed', 'Cancelled')
            GROUP BY br.id
            ORDER BY br.created_at DESC
        `, [req.user.id]);

        const [notifications] = await pool.query(`
            SELECT id, title, message, type, is_read, created_at
            FROM Notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.user.id]);

        res.json({
            mode: req.user.role,
            donor: {
                donation_count: donorProfile.donation_count,
                eligibility_status: donorProfile.eligibility_status || 'Not Submitted',
                last_donation_date: donorProfile.last_donation_date,
                cooldown_days_remaining: donorProfile.last_donation_date
                    ? Math.max(
                        0,
                        DONATION_COOLDOWN_DAYS - Math.floor((new Date() - new Date(donorProfile.last_donation_date)) / (1000 * 60 * 60 * 24))
                    )
                    : 0,
            },
            donateRequests,
            myRequests: myRequestRows,
            notifications,
            requests: req.user.role === 'hospital' ? myRequestRows : donateRequests,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.createRequest = async (req, res) => {
    const {
        patient_name,
        blood_group_required,
        latitude,
        longitude,
        units_required,
        emergency_level,
        patient_aadhaar_number,
        patient_aadhaar_document_name,
        patient_aadhaar_document_uri,
        request_device_id,
    } = req.body;
    const hospital_id = req.user.id;

    if (req.user.role === 'admin') {
        return res.status(403).json({ msg: 'Admin accounts cannot create mobile blood requests' });
    }

    const normalizedAadhaar = String(patient_aadhaar_number || '').replace(/\s+/g, '');
    if (!patient_name || !blood_group_required || !/^\d{12}$/.test(normalizedAadhaar) || !String(patient_aadhaar_document_name || '').trim()) {
        return res.status(400).json({ msg: 'Patient name, blood group, 12-digit Aadhaar, and Aadhaar upload are required' });
    }

    try {
        await expireOldRequests();
        const deviceId = String(request_device_id || '').trim();

        if (!deviceId) {
            return res.status(400).json({ msg: 'Device verification failed. Please reopen the app and try again.' });
        }

        const [dailyRequests] = await pool.query(`
            SELECT id
            FROM BloodRequests
            WHERE DATE(created_at) = CURRENT_DATE
            AND (hospital_id = ? OR request_device_id = ?)
            LIMIT 1
        `, [hospital_id, deviceId]);

        if (dailyRequests.length > 0) {
            return res.status(400).json({ msg: 'Only one blood request is allowed per device/account in one day. Please try again tomorrow.' });
        }

        const qrPayload = JSON.stringify({
            request_id: 0,
            hospital_id,
            patient_name,
            patient_aadhaar_last4: normalizedAadhaar.slice(-4),
            blood_group_required,
            purpose: 'LifeDrop Patient QR',
        });
        const patientQrCode = await qrcode.toDataURL(qrPayload);

        const [result] = await pool.query(
            `INSERT INTO BloodRequests (
                hospital_id, patient_name, patient_aadhaar_number, patient_aadhaar_document_name,
                patient_aadhaar_document_uri, patient_qr_code, blood_group_required,
                latitude, longitude, units_required, emergency_level, request_device_id, request_status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                hospital_id,
                patient_name,
                normalizedAadhaar,
                patient_aadhaar_document_name,
                patient_aadhaar_document_uri || '',
                patientQrCode,
                blood_group_required,
                latitude,
                longitude,
                units_required || 1,
                emergency_level || 'High',
                deviceId,
                'Searching Donor',
            ]
        );

        const finalQrPayload = JSON.stringify({
            request_id: result.insertId,
            hospital_id,
            patient_name,
            patient_aadhaar_last4: normalizedAadhaar.slice(-4),
            blood_group_required,
            purpose: 'LifeDrop Patient QR',
        });
        const finalPatientQrCode = await qrcode.toDataURL(finalQrPayload);
        await pool.query('UPDATE BloodRequests SET patient_qr_code = ? WHERE id = ?', [finalPatientQrCode, result.insertId]);

        const compatibleDonorGroups = getCompatibleDonors(blood_group_required);
        if (compatibleDonorGroups.length > 0) {
            const [candidateDonors] = await pool.query(`
                SELECT u.id, u.name, u.latitude, u.longitude, u.last_donation_date
                FROM Users u
                LEFT JOIN HealthInfo h ON h.user_id = u.id
                WHERE u.role = 'donor'
                AND u.id <> ?
                AND u.blood_group IN (?)
                AND u.availability_status = 'Available'
                AND u.aadhaar_verification_status = 'Verified'
                AND COALESCE(h.eligibility_status, 'Not Submitted') = 'Eligible'
                AND (
                    u.last_donation_date IS NULL
                    OR u.last_donation_date <= DATE_SUB(CURRENT_DATE, INTERVAL ${DONATION_COOLDOWN_DAYS} DAY)
                )
            `, [hospital_id, compatibleDonorGroups]);

            const nearbyCompatibleDonors = candidateDonors.filter((donor) => (
                donor.latitude
                && donor.longitude
                && getDistance(latitude, longitude, donor.latitude, donor.longitude) <= DONOR_RADIUS_KM
            ));

            if (nearbyCompatibleDonors.length > 0) {
                const notificationRows = nearbyCompatibleDonors.map((donor) => [
                    donor.id,
                    `Blood request for ${blood_group_required}`,
                    `${patient_name} needs ${units_required || 1} unit(s) within ${DONOR_RADIUS_KM} km. Open Donate Blood to respond.`,
                    'Request',
                ]);

                await pool.query(
                    'INSERT INTO Notifications (user_id, title, message, type) VALUES ?',
                    [notificationRows]
                );
            }
        }

        res.status(201).json({ msg: 'Blood request created', requestId: result.insertId });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getNearbyDonors = async (req, res) => {
    const { requestId } = req.params;

    try {
        const [requests] = await pool.query('SELECT * FROM BloodRequests WHERE id = ?', [requestId]);
        if (requests.length === 0) return res.status(404).json({ msg: 'Request not found' });
        const request = requests[0];

        const compatibleGroups = getCompatibleDonors(request.blood_group_required);
        if (compatibleGroups.length === 0) return res.json({ donors: [] });

        const [donors] = await pool.query(`
            SELECT u.id, u.name, u.phone, u.blood_group, u.latitude, u.longitude, u.last_donation_date, h.eligibility_status 
            FROM Users u 
            LEFT JOIN HealthInfo h ON u.id = h.user_id 
            WHERE u.role = 'donor' 
            AND u.id <> ?
            AND u.availability_status = 'Available'
            AND u.blood_group IN (?)
        `, [request.hospital_id, compatibleGroups]);

        const eligibleDonors = donors.filter(d => {
            if (d.eligibility_status !== 'Eligible') return false;
            if (d.last_donation_date) {
                const daysSince = Math.floor((new Date() - new Date(d.last_donation_date)) / (1000 * 60 * 60 * 24));
                if (daysSince < DONATION_COOLDOWN_DAYS) return false;
            }
            return true;
        });

        const radius = DONOR_RADIUS_KM;
        
        const nearbyDonors = eligibleDonors.map(d => {
            const distance = getDistance(request.latitude, request.longitude, d.latitude, d.longitude);
            return { ...d, distance };
        }).filter(d => d.distance <= radius)
          .sort((a, b) => a.distance - b.distance);

        res.json({ donors: nearbyDonors, radius });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.acceptRequest = async (req, res) => {
    const { requestId } = req.body;
    const donor_id = req.user.id;

    try {
        await expireOldRequests();

        const [requests] = await pool.query('SELECT * FROM BloodRequests WHERE id = ?', [requestId]);
        if (requests.length === 0) return res.status(404).json({ msg: 'Request not found' });
        
        const [existing] = await pool.query('SELECT * FROM BackupDonors WHERE request_id = ? AND donor_id = ?', [requestId, donor_id]);
        if (existing.length > 0) return res.status(400).json({ msg: 'Already accepted this request' });

        const [allAccepted] = await pool.query(`
            SELECT b.*, u.latitude, u.longitude 
            FROM BackupDonors b 
            JOIN Users u ON b.donor_id = u.id 
            WHERE b.request_id = ?`, [requestId]);

        const [donorInfo] = await pool.query(`
            SELECT u.latitude, u.longitude, u.last_donation_date, u.aadhaar_verification_status,
                COALESCE(h.eligibility_status, 'Not Submitted') AS eligibility_status
            FROM Users u
            LEFT JOIN HealthInfo h ON h.user_id = u.id
            WHERE u.id = ?
        `, [donor_id]);
        
        if (donorInfo.length === 0) return res.status(404).json({ msg: 'User info not found' });

        if (donorInfo[0].eligibility_status !== 'Eligible' || donorInfo[0].aadhaar_verification_status !== 'Verified') {
            return res.status(403).json({ msg: 'Donor must be eligibility-approved and Aadhaar verified by admin' });
        }

        if (donorInfo[0].last_donation_date) {
            const daysSince = Math.floor((new Date() - new Date(donorInfo[0].last_donation_date)) / (1000 * 60 * 60 * 24));
            if (daysSince < DONATION_COOLDOWN_DAYS) {
                return res.status(403).json({ msg: `Donor cooldown active. Wait ${DONATION_COOLDOWN_DAYS - daysSince} more day(s).` });
            }
        }

        const request = requests[0];
        if (request.hospital_id === donor_id) {
            return res.status(403).json({ msg: 'You cannot donate blood for your own request.' });
        }

        const newDistance = getDistance(request.latitude, request.longitude, donorInfo[0].latitude, donorInfo[0].longitude);

        if (newDistance > DONOR_RADIUS_KM) {
            return res.status(403).json({ msg: `You are ${newDistance.toFixed(1)} km away. Donation requests can only be accepted within ${DONOR_RADIUS_KM} km.` });
        }
        
        // Re-calculate ranks
        let participants = allAccepted.map(a => {
            const dist = getDistance(request.latitude, request.longitude, a.latitude, a.longitude);
            return { id: a.donor_id, distance: dist, bd_id: a.id };
        });

        participants.push({ id: donor_id, distance: newDistance, isNew: true });
        participants.sort((a, b) => a.distance - b.distance);

        await pool.query('START TRANSACTION');

        for (let i = 0; i < participants.length; i++) {
            const rank = i + 1;
            const p = participants[i];
            if (p.isNew) {
                await pool.query('INSERT INTO BackupDonors (request_id, donor_id, rank_order) VALUES (?, ?, ?)', [requestId, p.id, rank]);
            } else {
                await pool.query('UPDATE BackupDonors SET rank_order = ? WHERE id = ?', [rank, p.bd_id]);
            }
        }

        const primaryDonor = participants[0];
        await pool.query('UPDATE BloodRequests SET request_status = ? WHERE id = ?', ['Primary Donor Assigned', requestId]);

        await pool.query('COMMIT');

        const assignedRank = participants.findIndex(p => p.id === donor_id) + 1;
        
        res.json({ msg: 'Request accepted', rank: assignedRank });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.cancelRequest = async (req, res) => {
    // For when donor cancels
    const { requestId } = req.body;
    const donor_id = req.user.id;
    try {
        await pool.query('DELETE FROM BackupDonors WHERE request_id = ? AND donor_id = ?', [requestId, donor_id]);
        
        // If primary cancelled, recalculate ranks and assign new primary
        const [remaining] = await pool.query('SELECT * FROM BackupDonors WHERE request_id = ? ORDER BY rank_order ASC', [requestId]);
        
        if (remaining.length > 0) {
            for (let i = 0; i < remaining.length; i++) {
                await pool.query('UPDATE BackupDonors SET rank_order = ? WHERE id = ?', [i + 1, remaining[i].id]);
            }
        } else {
            await pool.query('UPDATE BloodRequests SET request_status = ? WHERE id = ?', ['Searching Donor', requestId]);
        }
        res.json({ msg: 'Request cancelled by donor' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
