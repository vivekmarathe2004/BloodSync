const pool = require("../config/db");
const isMissingSchemaError = (error) =>
  error && (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE");
const isStatusTruncationError = (error) => error && error.code === "WARN_DATA_TRUNCATED";
const toLegacyStatus = (status) => {
  if (status === "pending" || status === "matched") return "active";
  if (status === "expired") return "cancelled";
  return status;
};

const createBloodRequest = async ({
  hospitalId,
  bloodGroup,
  units,
  urgency,
  city,
  requestType,
  latitude,
  longitude,
  requiredByDate,
  notesText,
}) => {
  const expiresInHours = requestType === "emergency" ? 6 : 24;
  try {
    const [result] = await pool.execute(
      `INSERT INTO blood_requests (
        hospital_id, blood_group, units, urgency, city, request_type, latitude, longitude, status, required_by_date, notes_text, expires_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
      [
        hospitalId,
        bloodGroup,
        units,
        urgency,
        city,
        requestType || "normal",
        latitude || null,
        longitude || null,
        requiredByDate || null,
        notesText || null,
        expiresInHours,
      ]
    );
    return result.insertId;
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      const [result] = await pool.execute(
        `INSERT INTO blood_requests (hospital_id, blood_group, units, urgency, city, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [hospitalId, bloodGroup, units, urgency, city]
      );
      return result.insertId;
    }
    throw error;
  }
};

const getRequestById = async (requestId) => {
  const [rows] = await pool.execute("SELECT * FROM blood_requests WHERE id = ? LIMIT 1", [requestId]);
  return rows[0];
};

const findDuplicateOpenRequest = async ({ hospitalId, bloodGroup, city }) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id
       FROM blood_requests
       WHERE hospital_id = ?
         AND blood_group = ?
         AND city = ?
         AND status IN ('pending', 'matched')
       ORDER BY created_at DESC
       LIMIT 1`,
      [hospitalId, bloodGroup, city]
    );
    return rows[0];
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      const [rows] = await pool.execute(
        `SELECT id
         FROM blood_requests
         WHERE hospital_id = ?
           AND blood_group = ?
           AND city = ?
           AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [hospitalId, bloodGroup, city]
      );
      return rows[0];
    }
    throw error;
  }
};

const expireOldRequests = async () => {
  try {
    await pool.execute(
      `UPDATE blood_requests
       SET status = 'expired'
       WHERE status IN ('pending', 'matched')
         AND expires_at IS NOT NULL
         AND expires_at < NOW()`
    );
  } catch (error) {
    if (!(error && (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE"))) {
      throw error;
    }
  }
};

const getAllActiveRequests = async () => {
  await expireOldRequests();
  const [rows] = await pool.execute(
    `SELECT br.*, h.hospital_name, h.address
     FROM blood_requests br
     INNER JOIN hospitals h ON h.user_id = br.hospital_id
     WHERE br.status IN ('pending', 'matched')
     ORDER BY br.created_at DESC`
  );
  return rows;
};

const updateRequestStatus = async (requestId, status) => {
  try {
    const [result] = await pool.execute("UPDATE blood_requests SET status = ? WHERE id = ?", [status, requestId]);
    return result.affectedRows > 0;
  } catch (error) {
    if (isStatusTruncationError(error)) {
      const [result] = await pool.execute("UPDATE blood_requests SET status = ? WHERE id = ?", [
        toLegacyStatus(status),
        requestId,
      ]);
      return result.affectedRows > 0;
    }
    throw error;
  }
};

const updateRequestStatusForHospital = async (requestId, hospitalId, status) => {
  try {
    const [result] = await pool.execute("UPDATE blood_requests SET status = ? WHERE id = ? AND hospital_id = ?", [
      status,
      requestId,
      hospitalId,
    ]);
    return result.affectedRows > 0;
  } catch (error) {
    if (isStatusTruncationError(error)) {
      const [result] = await pool.execute("UPDATE blood_requests SET status = ? WHERE id = ? AND hospital_id = ?", [
        toLegacyStatus(status),
        requestId,
        hospitalId,
      ]);
      return result.affectedRows > 0;
    }
    throw error;
  }
};

const cloneRequest = async (requestId, hospitalId) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO blood_requests (
        hospital_id, blood_group, units, urgency, city, request_type, latitude, longitude, status, required_by_date, notes_text, expires_at
      )
      SELECT
        ?, blood_group, units, urgency, city, request_type, latitude, longitude, 'pending', required_by_date, notes_text,
        DATE_ADD(NOW(), INTERVAL CASE WHEN request_type = 'emergency' THEN 6 ELSE 24 END HOUR)
      FROM blood_requests
      WHERE id = ? AND hospital_id = ?`,
      [hospitalId, requestId, hospitalId]
    );
    return result.insertId;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const [result] = await pool.execute(
        `INSERT INTO blood_requests (hospital_id, blood_group, units, urgency, city, status)
         SELECT ?, blood_group, units, urgency, city, 'active'
         FROM blood_requests
         WHERE id = ? AND hospital_id = ?`,
        [hospitalId, requestId, hospitalId]
      );
      return result.insertId;
    }
    if (isStatusTruncationError(error)) {
      const [result] = await pool.execute(
        `INSERT INTO blood_requests (hospital_id, blood_group, units, urgency, city, request_type, latitude, longitude, status, required_by_date, notes_text, expires_at)
         SELECT ?, blood_group, units, urgency, city, request_type, latitude, longitude, ?, required_by_date, notes_text,
                DATE_ADD(NOW(), INTERVAL CASE WHEN request_type = 'emergency' THEN 6 ELSE 24 END HOUR)
         FROM blood_requests
         WHERE id = ? AND hospital_id = ?`,
        [hospitalId, toLegacyStatus("pending"), requestId, hospitalId]
      );
      return result.insertId;
    }
    throw error;
  }
};

const updateBloodRequestForHospital = async (requestId, hospitalId, payload) => {
  const fields = [];
  const params = [];
  if (payload.bloodGroup) {
    fields.push("blood_group = ?");
    params.push(payload.bloodGroup);
  }
  if (payload.units != null) {
    fields.push("units = ?");
    params.push(Number(payload.units));
  }
  if (payload.urgency) {
    fields.push("urgency = ?");
    params.push(payload.urgency);
  }
  if (payload.city) {
    fields.push("city = ?");
    params.push(payload.city);
  }
  if (payload.requestType) {
    fields.push("request_type = ?");
    params.push(payload.requestType);
  }
  if (payload.latitude != null) {
    fields.push("latitude = ?");
    params.push(payload.latitude === "" ? null : Number(payload.latitude));
  }
  if (payload.longitude != null) {
    fields.push("longitude = ?");
    params.push(payload.longitude === "" ? null : Number(payload.longitude));
  }
  if (payload.requiredByDate !== undefined) {
    fields.push("required_by_date = ?");
    params.push(payload.requiredByDate || null);
  }
  if (payload.notes !== undefined || payload.notesText !== undefined) {
    fields.push("notes_text = ?");
    params.push(payload.notes ?? payload.notesText ?? null);
  }

  if (!fields.length) return false;

  params.push(requestId, hospitalId);
  const [result] = await pool.execute(
    `UPDATE blood_requests
     SET ${fields.join(", ")}
     WHERE id = ? AND hospital_id = ?`,
    params
  );
  return result.affectedRows > 0;
};

const getRequestsForHospital = async (hospitalId) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, blood_group, units, urgency, city, status, request_type, required_by_date, notes_text, expires_at, created_at
       FROM blood_requests
       WHERE hospital_id = ?
       ORDER BY created_at DESC`,
      [hospitalId]
    );
    return rows;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const [rows] = await pool.execute(
        `SELECT id, blood_group, units, urgency, city, status, NULL AS request_type, NULL AS required_by_date,
                NULL AS notes_text, NULL AS expires_at, created_at
         FROM blood_requests
         WHERE hospital_id = ?
         ORDER BY created_at DESC`,
        [hospitalId]
      );
      return rows;
    }
    throw error;
  }
};

module.exports = {
  createBloodRequest,
  getRequestById,
  findDuplicateOpenRequest,
  expireOldRequests,
  getAllActiveRequests,
  updateRequestStatus,
  updateRequestStatusForHospital,
  cloneRequest,
  updateBloodRequestForHospital,
  getRequestsForHospital,
};
