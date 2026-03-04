const pool = require("../config/db");

const hasColumn = async (tableName, columnName) => {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
};

const hasTable = async (tableName) => {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
};

const addColumnIfMissing = async (tableName, columnName, definition) => {
  const tableExists = await hasTable(tableName);
  if (!tableExists) return;
  const exists = await hasColumn(tableName, columnName);
  if (!exists) {
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const getColumnType = async (tableName, columnName) => {
  const [rows] = await pool.execute(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows[0]?.COLUMN_TYPE || "";
};

const ensureActivityLogsTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_user_id INT NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(40) NULL,
      entity_id INT NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_activity_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
};

const ensureCampsTables = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS camps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      camp_name VARCHAR(160) NOT NULL,
      location_text VARCHAR(255) NOT NULL,
      camp_date_text VARCHAR(20) NOT NULL,
      start_date_text VARCHAR(20) NULL,
      end_date_text VARCHAR(20) NULL,
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
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS camp_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      camp_id INT NOT NULL,
      donor_user_id INT NOT NULL,
      status_text VARCHAR(20) NOT NULL DEFAULT 'registered',
      created_at_ts BIGINT NOT NULL,
      updated_at_ts BIGINT NOT NULL,
      UNIQUE KEY uq_camp_donor (camp_id, donor_user_id),
      CONSTRAINT fk_camp_reg_camp FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE CASCADE,
      CONSTRAINT fk_camp_reg_donor FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS camp_attendance (
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
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS camp_donations (
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
    )
  `);
};

const ensureStockTransactionsTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
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
    )
  `);
};

const ensureBloodStockTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS blood_stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hospital_id INT NOT NULL,
      blood_group VARCHAR(4) NOT NULL,
      units_available INT NOT NULL DEFAULT 0,
      threshold_units INT NOT NULL DEFAULT 5,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_hospital_blood_group (hospital_id, blood_group),
      CONSTRAINT fk_stock_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(user_id) ON DELETE CASCADE
    )
  `);
};

const ensureNotificationsTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(40) NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      meta JSON NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

const ensureAppointmentsTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      donor_id INT NOT NULL,
      hospital_id INT NOT NULL,
      slot_at DATETIME NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'booked',
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const ensureQuestionnaireTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pre_donation_questionnaires (
      id INT AUTO_INCREMENT PRIMARY KEY,
      donor_id INT NOT NULL,
      appointment_id INT NULL,
      answers JSON NOT NULL,
      risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const ensureFeedbackTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS donor_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      donor_id INT NOT NULL,
      hospital_id INT NOT NULL,
      donation_id INT NULL,
      rating INT NOT NULL,
      feedback TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const ensureAnnouncementsTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      created_by INT NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      audience ENUM('all', 'donor', 'hospital', 'admin') NOT NULL DEFAULT 'all',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_announcement_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

const ensureRequestResponsesTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS request_responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      donor_id INT NOT NULL,
      status ENUM('accepted', 'declined') NOT NULL,
      decision_reason_text VARCHAR(255) NULL,
      responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_request_donor (request_id, donor_id),
      CONSTRAINT fk_response_request FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_response_donor FOREIGN KEY (donor_id) REFERENCES donors(user_id) ON DELETE CASCADE
    )
  `);
};

const ensureBloodRequestStatusCompatibility = async () => {
  const tableExists = await hasTable("blood_requests");
  if (!tableExists) return;
  const type = (await getColumnType("blood_requests", "status")).toLowerCase();
  if (!type.includes("enum(")) return;
  if (type.includes("'pending'") && type.includes("'matched'") && type.includes("'completed'")) return;

  await pool.execute(`
    ALTER TABLE blood_requests
    MODIFY COLUMN status ENUM('active','fulfilled','pending','matched','completed','cancelled','expired') NOT NULL DEFAULT 'pending'
  `);
  await pool.execute(`
    UPDATE blood_requests
    SET status = CASE
      WHEN status = 'active' THEN 'pending'
      WHEN status = 'fulfilled' THEN 'completed'
      ELSE status
    END
  `);
  await pool.execute(`
    ALTER TABLE blood_requests
    MODIFY COLUMN status ENUM('pending','matched','completed','cancelled','expired') NOT NULL DEFAULT 'pending'
  `);
};

const ensureSchema = async () => {
  await addColumnIfMissing("users", "state", "VARCHAR(120) NULL");
  await addColumnIfMissing("users", "latitude", "DECIMAL(10, 7) NULL");
  await addColumnIfMissing("users", "longitude", "DECIMAL(10, 7) NULL");
  await addColumnIfMissing("users", "is_active", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("users", "is_super_admin", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "deleted_at_ts", "BIGINT NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "created_by", "INT NULL");
  await addColumnIfMissing("users", "profile_photo_url", "VARCHAR(255) NULL");
  await addColumnIfMissing("donors", "weight_kg", "INT NULL");
  await addColumnIfMissing("donors", "preferred_location_text", "VARCHAR(120) NULL");
  await addColumnIfMissing("donors", "max_travel_km", "INT NOT NULL DEFAULT 25");
  await addColumnIfMissing("donors", "restriction_status_text", "VARCHAR(32) NOT NULL DEFAULT 'eligible'");
  await addColumnIfMissing("hospitals", "contact_phone", "VARCHAR(20) NULL");
  await addColumnIfMissing("hospitals", "contact_email", "VARCHAR(160) NULL");
  await addColumnIfMissing("hospitals", "logo_url", "VARCHAR(255) NULL");
  await addColumnIfMissing("hospitals", "operating_hours_text", "VARCHAR(255) NULL");
  await addColumnIfMissing("hospitals", "blood_bank_license_number", "VARCHAR(80) NULL");
  await addColumnIfMissing("hospitals", "verification_status_text", "VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing("blood_requests", "request_type", "ENUM('normal','emergency') NOT NULL DEFAULT 'normal'");
  await addColumnIfMissing("blood_requests", "expires_at", "DATETIME NULL");
  await addColumnIfMissing("blood_requests", "required_by_date", "DATETIME NULL");
  await addColumnIfMissing("blood_requests", "notes_text", "TEXT NULL");
  await ensureRequestResponsesTable();
  await addColumnIfMissing("request_responses", "decision_reason_text", "VARCHAR(255) NULL");
  await ensureActivityLogsTable();
  await ensureCampsTables();
  await addColumnIfMissing("camps", "start_date_text", "VARCHAR(20) NULL");
  await addColumnIfMissing("camps", "end_date_text", "VARCHAR(20) NULL");
  await pool.execute(`
    UPDATE camps
    SET start_date_text = COALESCE(NULLIF(start_date_text, ''), camp_date_text),
        end_date_text = COALESCE(NULLIF(end_date_text, ''), COALESCE(NULLIF(start_date_text, ''), camp_date_text))
    WHERE start_date_text IS NULL OR start_date_text = '' OR end_date_text IS NULL OR end_date_text = ''
  `);
  await ensureBloodStockTable();
  await ensureStockTransactionsTable();
  await ensureNotificationsTable();
  await ensureAppointmentsTable();
  await ensureQuestionnaireTable();
  await ensureFeedbackTable();
  await ensureAnnouncementsTable();
  await ensureBloodRequestStatusCompatibility();

  await pool.execute(`
    UPDATE blood_requests
    SET request_type = CASE WHEN urgency = 'critical' THEN 'emergency' ELSE 'normal' END
    WHERE request_type IS NULL OR request_type = ''
  `);
  await pool.execute(`
    UPDATE blood_requests
    SET expires_at = DATE_ADD(created_at, INTERVAL CASE WHEN request_type = 'emergency' THEN 6 ELSE 24 END HOUR)
    WHERE expires_at IS NULL
  `);

  await pool.execute(
    "UPDATE users SET is_super_admin = 1 WHERE email = ? AND role = 'admin'",
    ["admin@bloodsync.com"]
  );
};

module.exports = {
  ensureSchema,
};
