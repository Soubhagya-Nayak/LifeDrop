-- Active: 1772863687919@@127.0.0.1@3306@lifedrop
CREATE DATABASE IF NOT EXISTS lifedrop;
USE lifedrop;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    aadhaar_number VARCHAR(12),
    aadhaar_document_name VARCHAR(255),
    aadhaar_document_uri TEXT,
    aadhaar_verification_status ENUM('Pending', 'Verified', 'Rejected') DEFAULT 'Pending',
    aadhaar_nationality_status VARCHAR(80) DEFAULT 'Pending Review',
    trust_score INT DEFAULT 40,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    last_donation_date DATE,
    role ENUM('donor', 'hospital', 'admin') DEFAULT 'donor',
    donation_count INT DEFAULT 0,
    availability_status ENUM('Available', 'Unavailable', 'Busy') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE HealthInfo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    age INT NOT NULL DEFAULT 0,
    weight DECIMAL(5,2) NOT NULL DEFAULT 0,
    has_fever BOOLEAN DEFAULT FALSE,
    has_hiv BOOLEAN DEFAULT FALSE,
    has_hepatitis BOOLEAN DEFAULT FALSE,
    recent_surgery BOOLEAN DEFAULT FALSE,
    eligibility_status ENUM('Eligible', 'Ineligible') DEFAULT 'Ineligible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE Hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    hospital_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE BloodRequests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_aadhaar_number VARCHAR(12),
    patient_aadhaar_document_name VARCHAR(255),
    patient_aadhaar_document_uri TEXT,
    patient_qr_code LONGTEXT,
    blood_group_required ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    units_required INT DEFAULT 1,
    emergency_level ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'High',
    request_device_id VARCHAR(120),
    approved_donor_id INT NULL,
    request_status ENUM('Created', 'Searching Donor', 'Primary Donor Assigned', 'Donation In Progress', 'Completed', 'Cancelled') DEFAULT 'Created',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_donor_id) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE TABLE Donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    primary_donor_id INT,
    qr_code_hash VARCHAR(255),
    status ENUM('Pending', 'Verified', 'Completed', 'Failed') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES BloodRequests(id) ON DELETE CASCADE,
    FOREIGN KEY (primary_donor_id) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE TABLE BackupDonors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    donor_id INT NOT NULL,
    rank_order INT NOT NULL,
    status ENUM('Pending', 'Promoted', 'Released') DEFAULT 'Pending',
    FOREIGN KEY (request_id) REFERENCES BloodRequests(id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE Notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    type ENUM('Request', 'Alert', 'System') DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
