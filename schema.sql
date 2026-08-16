-- Community Blood & Platelet Emergency Network
-- MySQL schema (SQLAlchemy will auto-create this too, but here it is
-- explicitly in case you want to set the DB up by hand)

CREATE DATABASE IF NOT EXISTS blood_network
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE blood_network;

CREATE TABLE IF NOT EXISTS donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    blood_group VARCHAR(5) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(120),
    city VARCHAR(100) NOT NULL,
    can_donate_platelets BOOLEAN DEFAULT FALSE,
    last_donated VARCHAR(20),
    is_available BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_blood_group (blood_group),
    INDEX idx_city (city)
);

CREATE TABLE IF NOT EXISTS requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(120) NOT NULL,
    blood_group VARCHAR(5) NOT NULL,
    component VARCHAR(20) DEFAULT 'Whole Blood',
    units_needed INT DEFAULT 1,
    hospital VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    urgency VARCHAR(20) DEFAULT 'Normal',
    notes VARCHAR(300),
    status VARCHAR(20) DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_blood_group (blood_group),
    INDEX idx_status (status),
    INDEX idx_city (city)
);