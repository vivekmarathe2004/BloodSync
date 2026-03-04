DROP DATABASE IF EXISTS blood_donation_db;
CREATE DATABASE blood_donation_db;
USE blood_donation_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'donor', 'hospital') NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(120),
  state VARCHAR(120),
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  profile_photo_url VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at_ts BIGINT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE donors (
  user_id INT PRIMARY KEY,
  blood_group VARCHAR(4) NOT NULL,
  age INT NOT NULL,
  gender ENUM('male', 'female', 'other') NOT NULL,
  last_donation_date DATE NULL,
  eligible_status TINYINT(1) DEFAULT 1,
  health_info TEXT NULL,
  CONSTRAINT fk_donor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospitals (
  user_id INT PRIMARY KEY,
  hospital_name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20) NULL,
  contact_email VARCHAR(160) NULL,
  logo_url VARCHAR(255) NULL,
  operating_hours_text VARCHAR(255) NULL,
  blood_bank_license_number VARCHAR(80) NULL,
  verification_status_text VARCHAR(20) NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_hospital_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE blood_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  blood_group VARCHAR(4) NOT NULL,
  units INT NOT NULL,
  urgency ENUM('normal', 'urgent', 'critical') NOT NULL DEFAULT 'normal',
  request_type ENUM('normal', 'emergency') NOT NULL DEFAULT 'normal',
  city VARCHAR(120) NOT NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  status ENUM('pending', 'matched', 'completed', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  required_by_date DATETIME NULL,
  notes_text TEXT NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_request_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(user_id) ON DELETE CASCADE
);

CREATE TABLE request_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  donor_id INT NOT NULL,
  status ENUM('accepted', 'declined') NOT NULL,
  decision_reason_text VARCHAR(255) NULL,
  responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_request_donor (request_id, donor_id),
  CONSTRAINT fk_response_request FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_response_donor FOREIGN KEY (donor_id) REFERENCES donors(user_id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  donor_id INT NOT NULL,
  hospital_id INT NOT NULL,
  slot_at DATETIME NOT NULL,
  status ENUM('booked', 'rescheduled', 'cancelled', 'confirmed', 'completed') NOT NULL DEFAULT 'booked',
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointment_request FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointment_donor FOREIGN KEY (donor_id) REFERENCES donors(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_appointment_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(user_id) ON DELETE CASCADE
);

CREATE TABLE donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  request_id INT NOT NULL,
  donation_date DATE NOT NULL,
  units INT NOT NULL DEFAULT 1,
  status ENUM('pending', 'completed', 'rejected') NOT NULL DEFAULT 'completed',
  CONSTRAINT fk_donation_donor FOREIGN KEY (donor_id) REFERENCES donors(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_donation_request FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE
);

CREATE TABLE pre_donation_questionnaires (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  appointment_id INT NULL,
  answers JSON NOT NULL,
  risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questionnaire_donor FOREIGN KEY (donor_id) REFERENCES donors(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_questionnaire_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

CREATE TABLE donor_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  hospital_id INT NOT NULL,
  donation_id INT NULL,
  rating INT NOT NULL,
  feedback TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_donor FOREIGN KEY (donor_id) REFERENCES donors(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE SET NULL
);

CREATE TABLE blood_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  blood_group VARCHAR(4) NOT NULL,
  units_available INT NOT NULL DEFAULT 0,
  threshold_units INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hospital_blood_group (hospital_id, blood_group),
  CONSTRAINT fk_stock_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(user_id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  meta JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_by INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  audience ENUM('all', 'donor', 'hospital', 'admin') NOT NULL DEFAULT 'all',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcement_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id INT NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE camps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  camp_name VARCHAR(160) NOT NULL,
  location_text VARCHAR(255) NOT NULL,
  camp_date_text VARCHAR(20) NOT NULL,
  start_time_text VARCHAR(20) NOT NULL,
  end_time_text VARCHAR(20) NOT NULL,
  organizer_user_id INT NOT NULL,
  organizer_role_text VARCHAR(20) NOT NULL,
  description_text TEXT NULL,
  expected_donors INT NOT NULL DEFAULT 0,
  status_text VARCHAR(20) NOT NULL DEFAULT 'upcoming',
  created_at_ts BIGINT NOT NULL,
  updated_at_ts BIGINT NOT NULL,
  CONSTRAINT fk_camp_organizer FOREIGN KEY (organizer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE camp_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  camp_id INT NOT NULL,
  donor_user_id INT NOT NULL,
  status_text VARCHAR(20) NOT NULL DEFAULT 'registered',
  created_at_ts BIGINT NOT NULL,
  updated_at_ts BIGINT NOT NULL,
  UNIQUE KEY uq_camp_donor (camp_id, donor_user_id),
  CONSTRAINT fk_camp_reg_camp FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT fk_camp_reg_donor FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE camp_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  camp_id INT NOT NULL,
  donor_user_id INT NOT NULL,
  arrived_flag TINYINT(1) NOT NULL DEFAULT 0,
  donated_flag TINYINT(1) NOT NULL DEFAULT 0,
  units_collected INT NOT NULL DEFAULT 0,
  marked_by_user_id INT NULL,
  marked_at_ts BIGINT NOT NULL,
  UNIQUE KEY uq_camp_attendance (camp_id, donor_user_id),
  CONSTRAINT fk_camp_attendance_camp FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT fk_camp_attendance_donor FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE camp_donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  camp_id INT NOT NULL,
  donor_id INT NOT NULL,
  units INT NOT NULL DEFAULT 1,
  donation_date_text VARCHAR(20) NOT NULL,
  status_text VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at_ts BIGINT NOT NULL,
  UNIQUE KEY uq_camp_donation (camp_id, donor_id),
  CONSTRAINT fk_camp_donation_camp FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT fk_camp_donation_donor FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  blood_group VARCHAR(4) NOT NULL,
  action_text VARCHAR(20) NOT NULL,
  units_changed INT NOT NULL,
  units_before INT NOT NULL,
  units_after INT NOT NULL,
  notes_text VARCHAR(255) NULL,
  created_by_user_id INT NULL,
  created_at_ts BIGINT NOT NULL,
  CONSTRAINT fk_stock_tx_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_tx_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_city_state ON users (city, state);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_donors_blood_group ON donors (blood_group);
CREATE INDEX idx_requests_blood_group ON blood_requests (blood_group);
CREATE INDEX idx_requests_city_status ON blood_requests (city, status);
CREATE INDEX idx_requests_expires_at ON blood_requests (expires_at);
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_camps_status_date ON camps (status_text, camp_date_text);
CREATE INDEX idx_stock_tx_hospital_time ON stock_transactions (hospital_id, created_at_ts);

-- Password hash corresponds to: Password@123
INSERT INTO users (name, email, password, role, phone, city, state, latitude, longitude, is_super_admin, deleted_at_ts, created_by) VALUES
('Admin User', 'admin@bloodsync.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'admin', '9000000001', 'Nashik', 'Maharashtra', 19.9975, 73.7898, 1, 0, NULL),
('Donor 1', 'donor1@mail.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'donor', '9000000002', 'Pune', 'Maharashtra', 18.5204, 73.8567, 0, 0, 1),
('Donor 2', 'donor2@mail.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'donor', '9000000003', 'Mumbai', 'Maharashtra', 19.0760, 72.8777, 0, 0, 1),
('Donor 3', 'donor3@mail.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'donor', '9000000004', 'Dhule', 'Maharashtra', 20.9042, 74.7749, 0, 0, 1),
('Donor 4', 'donor4@mail.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'donor', '9000000005', 'Jalgoan', 'Maharashtra', 21.0077, 75.5626, 0, 0, 1),
('City Hospital A', 'hosp1@mail.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'hospital', '9000000022', 'Nashik', 'Maharashtra', 19.9975, 73.7898, 0, 0, 1),
('City Hospital B', 'hosp2@mail.com', '$2b$10$LJ6eW6Gf7VQY8Ikx4x0tp.v0fA77j9xQm6ofL8fKsz95syEHCqB7m', 'hospital', '9000000023', 'Pune', 'Maharashtra', 18.5204, 73.8567, 0, 0, 1);

INSERT INTO donors (user_id, blood_group, age, gender, last_donation_date, eligible_status) VALUES
(2, 'A+', 22, 'male', '2025-08-01', 1),
(3, 'B+', 21, 'female', '2025-12-15', 0),
(4, 'O+', 23, 'male', '2025-09-12', 1),
(5, 'AB-', 24, 'female', '2025-11-24', 0);

INSERT INTO hospitals
  (user_id, hospital_name, address, contact_phone, contact_email, operating_hours_text, blood_bank_license_number, verification_status_text)
VALUES
  (6, 'City Hospital A', 'College Road, Nashik', '9000000022', 'hosp1@mail.com', '24x7', 'MHBBA-001', 'verified'),
  (7, 'City Hospital B', 'Shivaji Nagar, Pune', '9000000023', 'hosp2@mail.com', '08:00-20:00', 'MHBBA-002', 'pending');

INSERT INTO blood_requests (hospital_id, blood_group, units, urgency, request_type, city, latitude, longitude, status, expires_at) VALUES
(6, 'A+', 2, 'urgent', 'normal', 'Nashik', 19.9975, 73.7898, 'pending', DATE_ADD(NOW(), INTERVAL 24 HOUR)),
(6, 'O-', 1, 'critical', 'emergency', 'Nashik', 19.9975, 73.7898, 'pending', DATE_ADD(NOW(), INTERVAL 6 HOUR)),
(7, 'B+', 3, 'normal', 'normal', 'Pune', 18.5204, 73.8567, 'matched', DATE_ADD(NOW(), INTERVAL 24 HOUR));

INSERT INTO blood_stock (hospital_id, blood_group, units_available, threshold_units) VALUES
(6, 'A+', 10, 4),
(6, 'O-', 2, 3),
(7, 'B+', 8, 5);

INSERT INTO activity_logs (actor_user_id, action, entity_type, entity_id, details) VALUES
(1, 'seed_initialized', 'system', NULL, JSON_OBJECT('version', '2.0'));
