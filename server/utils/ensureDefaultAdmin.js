const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const DEFAULT_ADMIN = {
    name: 'LifeDrop Admin',
    phone: '6372024022',
    password: 'kanha#143',
    blood_group: 'O+',
    aadhaar_number: '111122223333',
    aadhaar_document_name: 'admin-aadhaar.pdf',
    aadhaar_document_uri: 'seed://admin-aadhaar.pdf',
    latitude: 20.2961,
    longitude: 85.8245,
    role: 'admin',
};

const ensureDefaultAdmin = async () => {
    const [existingAdmin] = await pool.query(
        'SELECT id FROM Users WHERE role = ? OR phone = ? LIMIT 1',
        ['admin', DEFAULT_ADMIN.phone]
    );

    if (existingAdmin.length > 0) {
        return existingAdmin[0].id;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    const [result] = await pool.query(
        `INSERT INTO Users (
            name, phone, password_hash, blood_group,
            aadhaar_number, aadhaar_document_name, aadhaar_document_uri,
            aadhaar_verification_status, aadhaar_nationality_status, trust_score,
            latitude, longitude, role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            DEFAULT_ADMIN.name,
            DEFAULT_ADMIN.phone,
            passwordHash,
            DEFAULT_ADMIN.blood_group,
            DEFAULT_ADMIN.aadhaar_number,
            DEFAULT_ADMIN.aadhaar_document_name,
            DEFAULT_ADMIN.aadhaar_document_uri,
            'Verified',
            'Indian Aadhaar Submitted',
            95,
            DEFAULT_ADMIN.latitude,
            DEFAULT_ADMIN.longitude,
            DEFAULT_ADMIN.role,
        ]
    );

    return result.insertId;
};

module.exports = { ensureDefaultAdmin, DEFAULT_ADMIN };
