const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const demoUsers = [
    {
        name: 'LifeDrop Admin',
        phone: '6372024022',
        password: 'kanha#143',
        blood_group: 'O+',
        aadhaar_number: '111122223333',
        aadhaar_document_name: 'admin-aadhaar.pdf',
        aadhaar_document_uri: 'seed://admin-aadhaar.pdf',
        latitude: 19.076,
        longitude: 72.8777,
        role: 'admin',
    },
    {
        name: 'Demo Donor',
        phone: '6372024023',
        password: 'kanha#143',
        blood_group: 'O+',
        aadhaar_number: '222233334444',
        aadhaar_document_name: 'donor-aadhaar.pdf',
        aadhaar_document_uri: 'seed://donor-aadhaar.pdf',
        latitude: 19.082,
        longitude: 72.88,
        role: 'donor',
    },
    {
        name: 'Demo Requester',
        phone: '6372024024',
        password: 'kanha#143',
        blood_group: 'A+',
        aadhaar_number: '333344445555',
        aadhaar_document_name: 'requester-aadhaar.pdf',
        aadhaar_document_uri: 'seed://requester-aadhaar.pdf',
        latitude: 19.07,
        longitude: 72.875,
        role: 'hospital',
    },
];

const seedDemoUsers = async () => {
    try {
        for (const user of demoUsers) {
            const passwordHash = await bcrypt.hash(user.password, 10);

            const [existing] = await pool.query('SELECT id FROM Users WHERE phone = ?', [user.phone]);
            if (existing.length > 0) {
                await pool.query(
                    `UPDATE Users
                     SET name = ?, password_hash = ?, blood_group = ?, aadhaar_number = ?,
                         aadhaar_document_name = ?, aadhaar_document_uri = ?,
                         aadhaar_verification_status = ?, aadhaar_nationality_status = ?, trust_score = ?,
                         latitude = ?, longitude = ?, role = ?
                     WHERE phone = ?`,
                    [
                        user.name,
                        passwordHash,
                        user.blood_group,
                        user.aadhaar_number,
                        user.aadhaar_document_name,
                        user.aadhaar_document_uri,
                        'Verified',
                        'Indian Aadhaar Submitted',
                        95,
                        user.latitude,
                        user.longitude,
                        user.role,
                        user.phone,
                    ]
                );
            } else {
                await pool.query(
                    `INSERT INTO Users (
                        name, phone, password_hash, blood_group,
                        aadhaar_number, aadhaar_document_name, aadhaar_document_uri,
                        aadhaar_verification_status, aadhaar_nationality_status, trust_score,
                        latitude, longitude, role
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        user.name,
                        user.phone,
                        passwordHash,
                        user.blood_group,
                        user.aadhaar_number,
                        user.aadhaar_document_name,
                        user.aadhaar_document_uri,
                        'Verified',
                        'Indian Aadhaar Submitted',
                        95,
                        user.latitude,
                        user.longitude,
                        user.role,
                    ]
                );
            }
        }

        const [rows] = await pool.query(
            'SELECT id, name, phone, role, blood_group FROM Users WHERE phone IN (?, ?, ?) ORDER BY phone ASC',
            demoUsers.map((user) => user.phone)
        );

        console.log('Demo users ready:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Failed to seed demo users:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
};

seedDemoUsers();
