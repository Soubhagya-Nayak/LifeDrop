const pool = require('../config/db');
const { getDistance } = require('../utils/haversine');

const DONATION_COOLDOWN_DAYS = 112;

exports.getOverview = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Admin access only' });
    }

    try {
        const [donors] = await pool.query(`
            SELECT u.id, u.name, u.phone, u.blood_group, u.latitude, u.longitude,
                u.donation_count, u.availability_status, u.last_donation_date,
                u.aadhaar_number, u.aadhaar_document_name, u.aadhaar_document_uri,
                u.aadhaar_verification_status, u.aadhaar_nationality_status, u.trust_score,
                COALESCE(h.eligibility_status, 'Not Submitted') AS eligibility_status,
                h.age, h.weight, h.has_fever, h.has_hiv, h.has_hepatitis, h.recent_surgery
            FROM Users u
            LEFT JOIN HealthInfo h ON h.user_id = u.id
            WHERE u.role = 'donor'
            AND (
                u.last_donation_date IS NULL
                OR u.last_donation_date <= DATE_SUB(CURRENT_DATE, INTERVAL ${DONATION_COOLDOWN_DAYS} DAY)
            )
            ORDER BY u.updated_at DESC
        `);

        const [patients] = await pool.query(`
            SELECT br.id, br.patient_name, br.blood_group_required, br.latitude, br.longitude,
                br.patient_aadhaar_number, br.patient_aadhaar_document_name, br.patient_qr_code,
                br.units_required, br.emergency_level, br.request_status, br.created_at, br.approved_donor_id,
                u.name AS requester_name, u.phone AS requester_phone
            FROM BloodRequests br
            JOIN Users u ON u.id = br.hospital_id
            WHERE br.request_status NOT IN ('Completed', 'Cancelled')
            ORDER BY br.created_at DESC
        `);

        const patientsWithDistance = await Promise.all(patients.map(async (patient) => {
            const [queueRows] = await pool.query(`
                SELECT bd.donor_id, bd.rank_order, bd.status,
                    u.name, u.blood_group, u.latitude, u.longitude,
                    u.aadhaar_verification_status, u.trust_score,
                    COALESCE(h.eligibility_status, 'Not Submitted') AS eligibility_status
                FROM BackupDonors bd
                JOIN Users u ON u.id = bd.donor_id
                LEFT JOIN HealthInfo h ON h.user_id = u.id
                WHERE bd.request_id = ?
                ORDER BY bd.rank_order ASC
            `, [patient.id]);

            const queuedCandidate = queueRows[0];
            const nearestDonor = queuedCandidate
                ? {
                    id: queuedCandidate.donor_id,
                    name: queuedCandidate.name,
                    blood_group: queuedCandidate.blood_group,
                    latitude: queuedCandidate.latitude,
                    longitude: queuedCandidate.longitude,
                    assignment_status: queuedCandidate.status,
                    aadhaar_verification_status: queuedCandidate.aadhaar_verification_status,
                    trust_score: queuedCandidate.trust_score,
                    eligibility_status: queuedCandidate.eligibility_status,
                    distance: getDistance(patient.latitude, patient.longitude, queuedCandidate.latitude, queuedCandidate.longitude),
                }
                : donors
                    .filter((donor) => donor.eligibility_status === 'Eligible' && donor.latitude && donor.longitude)
                    .map((donor) => ({
                        id: donor.id,
                        name: donor.name,
                        blood_group: donor.blood_group,
                        latitude: donor.latitude,
                        longitude: donor.longitude,
                        assignment_status: 'Suggested',
                        aadhaar_verification_status: donor.aadhaar_verification_status,
                        trust_score: donor.trust_score,
                        eligibility_status: donor.eligibility_status,
                        distance: getDistance(patient.latitude, patient.longitude, donor.latitude, donor.longitude),
                    }))
                    .sort((a, b) => a.distance - b.distance)[0];

            return {
                ...patient,
                nearest_donor_id: nearestDonor?.id || null,
                nearest_donor_name: nearestDonor?.name || null,
                nearest_donor_blood_group: nearestDonor?.blood_group || null,
                nearest_donor_latitude: nearestDonor?.latitude || null,
                nearest_donor_longitude: nearestDonor?.longitude || null,
                nearest_donor_distance_km: nearestDonor ? Number(nearestDonor.distance.toFixed(2)) : null,
                nearest_donor_status: nearestDonor?.assignment_status || 'Waiting',
                nearest_donor_aadhaar_status: nearestDonor?.aadhaar_verification_status || 'Pending',
                nearest_donor_trust_score: nearestDonor?.trust_score || 0,
                nearest_donor_eligibility_status: nearestDonor?.eligibility_status || 'Not Submitted',
            };
        }));

        const stats = {
            donors: donors.length,
            eligibleDonors: donors.filter((donor) => donor.eligibility_status === 'Eligible').length,
            activeRequests: patientsWithDistance.filter((patient) => !['Completed', 'Cancelled'].includes(patient.request_status)).length,
            criticalRequests: patientsWithDistance.filter((patient) => patient.emergency_level === 'Critical').length,
        };

        const [donationRows] = await pool.query(`
            SELECT d.id, d.status, d.created_at,
                br.patient_name, br.blood_group_required, br.units_required,
                donor.name AS donor_name, donor.phone AS donor_phone,
                requester.name AS requester_name, requester.phone AS requester_phone
            FROM Donations d
            JOIN BloodRequests br ON br.id = d.request_id
            LEFT JOIN Users donor ON donor.id = d.primary_donor_id
            JOIN Users requester ON requester.id = br.hospital_id
            ORDER BY d.created_at DESC
        `);

        const historyByDate = donationRows.reduce((acc, row) => {
            const dateKey = new Date(row.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(row);
            return acc;
        }, {});

        res.json({ stats, donors, patients: patientsWithDistance, historyByDate });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updateDonorEligibility = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Admin access only' });
    }

    const { donorId, status } = req.body;
    if (!['Eligible', 'Ineligible'].includes(status)) {
        return res.status(400).json({ msg: 'Status must be Eligible or Ineligible' });
    }

    try {
        const [existing] = await pool.query('SELECT id FROM HealthInfo WHERE user_id = ?', [donorId]);

        if (existing.length > 0) {
            await pool.query(
                'UPDATE HealthInfo SET eligibility_status = ? WHERE user_id = ?',
                [status, donorId]
            );
        } else {
            await pool.query(
                `INSERT INTO HealthInfo (user_id, age, weight, has_fever, has_hiv, has_hepatitis, recent_surgery, eligibility_status)
                 VALUES (?, 0, 0, FALSE, FALSE, FALSE, FALSE, ?)`,
                [donorId, status]
            );
        }

        await pool.query(
            `UPDATE Users
             SET aadhaar_verification_status = ?, trust_score = LEAST(100, GREATEST(40, trust_score + ?))
             WHERE id = ?`,
            [status === 'Eligible' ? 'Verified' : 'Rejected', status === 'Eligible' ? 10 : -10, donorId]
        );

        res.json({ msg: `Donor marked as ${status}`, donorId, status });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.reviewRequestDonor = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Admin access only' });
    }

    const { requestId, donorId, decision } = req.body;
    if (!requestId || !donorId || !['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ msg: 'requestId, donorId and valid decision are required' });
    }

    try {
        if (decision === 'approve') {
            await pool.query('UPDATE BackupDonors SET status = ? WHERE request_id = ? AND donor_id = ?', ['Promoted', requestId, donorId]);
            await pool.query(
                'UPDATE BloodRequests SET approved_donor_id = ?, request_status = ? WHERE id = ?',
                [donorId, 'Donation In Progress', requestId]
            );
            return res.json({ msg: 'Donor approved for this receiver', requestId, donorId });
        }

        await pool.query('DELETE FROM BackupDonors WHERE request_id = ? AND donor_id = ?', [requestId, donorId]);

        const [remaining] = await pool.query(
            'SELECT id FROM BackupDonors WHERE request_id = ? ORDER BY rank_order ASC',
            [requestId]
        );

        for (let i = 0; i < remaining.length; i++) {
            await pool.query('UPDATE BackupDonors SET rank_order = ? WHERE id = ?', [i + 1, remaining[i].id]);
        }

        await pool.query(
            'UPDATE BloodRequests SET approved_donor_id = NULL, request_status = ? WHERE id = ?',
            [remaining.length > 0 ? 'Primary Donor Assigned' : 'Searching Donor', requestId]
        );

        res.json({ msg: 'Donor rejected and queue shifted', requestId, donorId });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.resetOperationalData = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Admin access only' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DELETE FROM Notifications');
        await connection.query('ALTER TABLE Notifications AUTO_INCREMENT = 1');
        await connection.query('DELETE FROM BackupDonors');
        await connection.query('ALTER TABLE BackupDonors AUTO_INCREMENT = 1');
        await connection.query('DELETE FROM Donations');
        await connection.query('ALTER TABLE Donations AUTO_INCREMENT = 1');
        await connection.query('DELETE FROM BloodRequests');
        await connection.query('ALTER TABLE BloodRequests AUTO_INCREMENT = 1');
        await connection.query('DELETE FROM Hospitals');
        await connection.query('ALTER TABLE Hospitals AUTO_INCREMENT = 1');
        await connection.query(`
            DELETE h
            FROM HealthInfo h
            JOIN Users u ON u.id = h.user_id
            WHERE u.role <> 'admin'
        `);
        await connection.query('ALTER TABLE HealthInfo AUTO_INCREMENT = 1');
        await connection.query("DELETE FROM Users WHERE role <> 'admin'");
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        res.json({
            msg: 'All donor and receiver data erased. Admin accounts preserved.',
            stats: { donors: 0, eligibleDonors: 0, activeRequests: 0, criticalRequests: 0 },
            donors: [],
            patients: [],
            historyByDate: {},
        });
    } catch (err) {
        if (connection) {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        if (connection) {
            connection.release();
        }
    }
};
