const qrcode = require('qrcode');
const pool = require('../config/db');

exports.generateQR = async (req, res) => {
    const { requestId } = req.body;
    const donor_id = req.user.id;

    try {
        const [request] = await pool.query('SELECT * FROM BloodRequests WHERE id = ?', [requestId]);
        if (request.length === 0) return res.status(404).json({ msg: 'Request not found' });
        
        let primary_donor_id = donor_id; // Simpler assumption for this endpoint
        const qrData = JSON.stringify({
            donor_id,
            request_id: requestId,
            hospital_id: request[0].hospital_id,
            timestamp: new Date().toISOString()
        });
        
        const qrCodeHash = await qrcode.toDataURL(qrData);

        const [existing] = await pool.query('SELECT * FROM Donations WHERE request_id = ? AND primary_donor_id = ?', [requestId, donor_id]);
        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO Donations (request_id, primary_donor_id, qr_code_hash, status) VALUES (?, ?, ?, ?)',
                [requestId, donor_id, qrCodeHash, 'Pending']
            );
        } else {
            await pool.query('UPDATE Donations SET qr_code_hash = ? WHERE request_id = ? AND primary_donor_id = ?', [qrCodeHash, requestId, donor_id]);
        }
        res.json({ qrCode: qrCodeHash });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.verifyQR = async (req, res) => {
    const { qrDataString } = req.body;
    const hospital_id = req.user.id; // scanner must be hospital

    try {
        const data = JSON.parse(qrDataString);

        if (data.hospital_id !== hospital_id) {
            return res.status(403).json({ msg: 'Not authorized to verify this request' });
        }

        const [donation] = await pool.query('SELECT * FROM Donations WHERE request_id = ? AND primary_donor_id = ?', [data.request_id, data.donor_id]);
        
        if (donation.length === 0) return res.status(404).json({ msg: 'Donation record not found' });

        await pool.query('UPDATE Donations SET status = ? WHERE id = ?', ['Completed', donation[0].id]);
        
        await pool.query('UPDATE BloodRequests SET request_status = ? WHERE id = ?', ['Completed', data.request_id]);
        
        await pool.query('UPDATE Users SET donation_count = donation_count + 1, last_donation_date = CURRENT_DATE WHERE id = ?', [data.donor_id]);

        res.json({ msg: 'QR Verified and Donation Complete' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error or Invalid QR Format');
    }
};

exports.scanPatientQR = async (req, res) => {
    const { qrDataString } = req.body;
    const donor_id = req.user.id;

    try {
        const data = JSON.parse(qrDataString);

        const [[request]] = await pool.query(
            'SELECT id, approved_donor_id, request_status, hospital_id FROM BloodRequests WHERE id = ?',
            [data.request_id]
        );

        if (!request) {
            return res.status(404).json({ msg: 'Request not found' });
        }

        if (request.approved_donor_id !== donor_id) {
            return res.status(403).json({ msg: 'This QR does not belong to your approved donation assignment' });
        }

        if (request.request_status !== 'Donation In Progress') {
            return res.status(400).json({ msg: `Request is not ready for donation scan. Current status: ${request.request_status}` });
        }

        const [existing] = await pool.query(
            'SELECT id FROM Donations WHERE request_id = ? AND primary_donor_id = ?',
            [request.id, donor_id]
        );

        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO Donations (request_id, primary_donor_id, qr_code_hash, status) VALUES (?, ?, ?, ?)',
                [request.id, donor_id, qrDataString, 'Completed']
            );
        } else {
            await pool.query(
                'UPDATE Donations SET qr_code_hash = ?, status = ? WHERE id = ?',
                [qrDataString, 'Completed', existing[0].id]
            );
        }

        await pool.query('UPDATE BloodRequests SET request_status = ? WHERE id = ?', ['Completed', request.id]);
        await pool.query(
            'UPDATE Users SET donation_count = donation_count + 1, last_donation_date = CURRENT_DATE, availability_status = ? WHERE id = ?',
            ['Busy', donor_id]
        );

        res.json({ msg: 'Donation completed for the correct patient', requestId: request.id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error or Invalid QR Format');
    }
};

exports.getDonationHistory = async (req, res) => {
    try {
        const isRequester = req.user.role === 'hospital';
        const query = isRequester
            ? `
                SELECT d.id, d.status, d.created_at,
                    br.id AS request_id, br.patient_name, br.blood_group_required,
                    br.units_required, br.emergency_level, br.request_status,
                    donor.name AS donor_name, donor.phone AS donor_phone,
                    requester.name AS requester_name
                FROM Donations d
                JOIN BloodRequests br ON br.id = d.request_id
                LEFT JOIN Users donor ON donor.id = d.primary_donor_id
                JOIN Users requester ON requester.id = br.hospital_id
                WHERE br.hospital_id = ?
                ORDER BY d.created_at DESC
            `
            : `
                SELECT d.id, d.status, d.created_at,
                    br.id AS request_id, br.patient_name, br.blood_group_required,
                    br.units_required, br.emergency_level, br.request_status,
                    donor.name AS donor_name, donor.phone AS donor_phone,
                    requester.name AS requester_name
                FROM Donations d
                JOIN BloodRequests br ON br.id = d.request_id
                LEFT JOIN Users donor ON donor.id = d.primary_donor_id
                JOIN Users requester ON requester.id = br.hospital_id
                WHERE d.primary_donor_id = ?
                ORDER BY d.created_at DESC
            `;

        const [rows] = await pool.query(query, [req.user.id]);

        res.json({ history: rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
