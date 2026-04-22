const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { ensureDefaultAdmin } = require('../utils/ensureDefaultAdmin');

const calculateTrustScore = ({ aadhaar_number, aadhaar_document_name }) => {
    let score = 40;
    if (/^\d{12}$/.test(String(aadhaar_number || '').trim())) {
        score += 35;
    }
    if (String(aadhaar_document_name || '').trim()) {
        score += 20;
    }
    return Math.min(score, 95);
};

exports.register = async (req, res) => {
    const {
        name,
        phone,
        password,
        blood_group,
        latitude,
        longitude,
        role,
        aadhaar_number,
        aadhaar_document_name,
        aadhaar_document_uri,
    } = req.body;
    const normalizedPhone = String(phone || '').trim();
    const normalizedAadhaar = String(aadhaar_number || '').replace(/\s+/g, '');

    if (!/^\d{12}$/.test(normalizedAadhaar)) {
        return res.status(400).json({ msg: 'Valid 12-digit Aadhaar number is required' });
    }

    if (!String(aadhaar_document_name || '').trim()) {
        return res.status(400).json({ msg: 'Aadhaar card document upload is required' });
    }

    try {
        await ensureDefaultAdmin();
        const [existing] = await pool.query('SELECT * FROM Users WHERE phone = ?', [normalizedPhone]);
        if (existing.length > 0) return res.status(400).json({ msg: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const trust_score = calculateTrustScore({
            aadhaar_number: normalizedAadhaar,
            aadhaar_document_name,
        });
        const aadhaar_nationality_status = 'Indian Aadhaar Submitted';

        const [result] = await pool.query(
            `INSERT INTO Users (
                name, phone, password_hash, blood_group, aadhaar_number,
                aadhaar_document_name, aadhaar_document_uri, aadhaar_verification_status,
                aadhaar_nationality_status, trust_score, latitude, longitude, role
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                normalizedPhone,
                password_hash,
                blood_group,
                normalizedAadhaar,
                aadhaar_document_name,
                aadhaar_document_uri || '',
                'Pending',
                aadhaar_nationality_status,
                trust_score,
                latitude,
                longitude,
                role || 'donor'
            ]
        );

        res.status(201).json({ msg: 'User registered successfully', userId: result.insertId });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.login = async (req, res) => {
    const { phone, password } = req.body;
    const normalizedPhone = String(phone || '').trim();

    try {
        await ensureDefaultAdmin();
        const [users] = await pool.query('SELECT * FROM Users WHERE phone = ?', [normalizedPhone]);
        if (users.length === 0) return res.status(400).json({ msg: 'Invalid Credentials' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    role: user.role,
                    bloodGroup: user.blood_group,
                    donationCount: user.donation_count,
                    availabilityStatus: user.availability_status,
                    aadhaarVerificationStatus: user.aadhaar_verification_status,
                    trustScore: user.trust_score,
                }
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updateLocation = async (req, res) => {
    const { latitude, longitude } = req.body;

    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
        return res.status(400).json({ msg: 'Valid latitude and longitude are required' });
    }

    try {
        await pool.query(
            'UPDATE Users SET latitude = ?, longitude = ? WHERE id = ?',
            [Number(latitude), Number(longitude), req.user.id]
        );

        res.json({
            msg: 'Location updated',
            latitude: Number(latitude),
            longitude: Number(longitude),
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
