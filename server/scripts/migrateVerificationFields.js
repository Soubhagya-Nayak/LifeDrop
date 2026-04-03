const pool = require('../config/db');

const statements = [
    "ALTER TABLE Users ADD COLUMN aadhaar_number VARCHAR(12) NULL",
    "ALTER TABLE Users ADD COLUMN aadhaar_document_name VARCHAR(255) NULL",
    "ALTER TABLE Users ADD COLUMN aadhaar_document_uri TEXT NULL",
    "ALTER TABLE Users ADD COLUMN aadhaar_verification_status ENUM('Pending', 'Verified', 'Rejected') DEFAULT 'Pending'",
    "ALTER TABLE Users ADD COLUMN aadhaar_nationality_status VARCHAR(80) DEFAULT 'Pending Review'",
    "ALTER TABLE Users ADD COLUMN trust_score INT DEFAULT 40",
    "ALTER TABLE BloodRequests ADD COLUMN approved_donor_id INT NULL",
    "ALTER TABLE BloodRequests ADD COLUMN patient_aadhaar_number VARCHAR(12) NULL",
    "ALTER TABLE BloodRequests ADD COLUMN patient_aadhaar_document_name VARCHAR(255) NULL",
    "ALTER TABLE BloodRequests ADD COLUMN patient_aadhaar_document_uri TEXT NULL",
    "ALTER TABLE BloodRequests ADD COLUMN patient_qr_code LONGTEXT NULL",
    "ALTER TABLE BloodRequests ADD COLUMN request_device_id VARCHAR(120) NULL",
];

const migrate = async () => {
    try {
        for (const statement of statements) {
            try {
                await pool.query(statement);
                console.log(`Applied: ${statement}`);
            } catch (err) {
                if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code)) {
                    throw err;
                }
                console.log(`Skipped existing column: ${statement}`);
            }
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
};

migrate();
