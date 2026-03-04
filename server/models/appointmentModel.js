const pool = require("../config/db");

const toMySqlDateTime = (input) => {
  if (!input) return null;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)) {
    return input;
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toISOString().slice(0, 19).replace("T", " ");
};

const hasConflictingAppointment = async ({ hospitalId, donorId, slotAt, excludeAppointmentId }) => {
  const normalizedSlotAt = toMySqlDateTime(slotAt);
  const params = [hospitalId, normalizedSlotAt, donorId, normalizedSlotAt];
  let excludeSql = "";
  if (excludeAppointmentId) {
    excludeSql = "AND id <> ?";
    params.push(Number(excludeAppointmentId));
  }

  const [rows] = await pool.execute(
    `SELECT id
     FROM appointments
     WHERE status NOT IN ('cancelled', 'completed')
       AND (
         (hospital_id = ? AND slot_at = ?)
         OR (donor_id = ? AND slot_at = ?)
       )
       ${excludeSql}
     LIMIT 1`,
    params
  );
  return Boolean(rows[0]);
};

const createAppointment = async ({ requestId, donorId, hospitalId, slotAt, notes }) => {
  const normalizedSlotAt = toMySqlDateTime(slotAt);
  const hasConflict = await hasConflictingAppointment({ hospitalId, donorId, slotAt: normalizedSlotAt });
  if (hasConflict) {
    const error = new Error("This slot is already booked for hospital or donor.");
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.execute(
    `INSERT INTO appointments (request_id, donor_id, hospital_id, slot_at, notes, status)
     VALUES (?, ?, ?, ?, ?, 'booked')`,
    [requestId, donorId, hospitalId, normalizedSlotAt, notes || null]
  );
  return result.insertId;
};

const updateAppointment = async (appointmentId, donorId, { slotAt, status }) => {
  const normalizedSlotAt = toMySqlDateTime(slotAt);
  if (slotAt) {
    const [[appointment]] = await pool.execute("SELECT hospital_id FROM appointments WHERE id = ? AND donor_id = ? LIMIT 1", [
      appointmentId,
      donorId,
    ]);
    if (!appointment) return false;
    const hasConflict = await hasConflictingAppointment({
      hospitalId: Number(appointment.hospital_id),
      donorId: Number(donorId),
      slotAt: normalizedSlotAt,
      excludeAppointmentId: appointmentId,
    });
    if (hasConflict) {
      const error = new Error("This slot is already booked for hospital or donor.");
      error.statusCode = 409;
      throw error;
    }
  }

  const fields = [];
  const params = [];
  if (slotAt) {
    fields.push("slot_at = ?");
    params.push(normalizedSlotAt);
  }
  if (status) {
    fields.push("status = ?");
    params.push(status);
  }
  if (!fields.length) return false;

  params.push(appointmentId, donorId);
  const [result] = await pool.execute(
    `UPDATE appointments
     SET ${fields.join(", ")}
     WHERE id = ? AND donor_id = ?`,
    params
  );
  return result.affectedRows > 0;
};

const confirmAppointmentByHospital = async (appointmentId, hospitalId, status) => {
  const [result] = await pool.execute(
    "UPDATE appointments SET status = ? WHERE id = ? AND hospital_id = ?",
    [status, appointmentId, hospitalId]
  );
  return result.affectedRows > 0;
};

const updateAppointmentByHospital = async (appointmentId, hospitalId, { slotAt, status }) => {
  const normalizedSlotAt = toMySqlDateTime(slotAt);
  if (slotAt) {
    const [[appointment]] = await pool.execute(
      "SELECT donor_id, hospital_id FROM appointments WHERE id = ? AND hospital_id = ? LIMIT 1",
      [appointmentId, hospitalId]
    );
    if (!appointment) return false;
    const hasConflict = await hasConflictingAppointment({
      hospitalId: Number(appointment.hospital_id),
      donorId: Number(appointment.donor_id),
      slotAt: normalizedSlotAt,
      excludeAppointmentId: appointmentId,
    });
    if (hasConflict) {
      const error = new Error("This slot is already booked for hospital or donor.");
      error.statusCode = 409;
      throw error;
    }
  }

  const fields = [];
  const params = [];
  if (slotAt) {
    fields.push("slot_at = ?");
    params.push(normalizedSlotAt);
  }
  if (status) {
    fields.push("status = ?");
    params.push(status);
  }
  if (!fields.length) return false;

  params.push(appointmentId, hospitalId);
  const [result] = await pool.execute(
    `UPDATE appointments
     SET ${fields.join(", ")}
     WHERE id = ? AND hospital_id = ?`,
    params
  );
  return result.affectedRows > 0;
};

const getDonorAppointments = async (donorId) => {
  const [rows] = await pool.execute(
    `SELECT a.*, h.hospital_name, br.blood_group
     FROM appointments a
     INNER JOIN hospitals h ON h.user_id = a.hospital_id
     INNER JOIN blood_requests br ON br.id = a.request_id
     WHERE a.donor_id = ?
     ORDER BY a.slot_at ASC`,
    [donorId]
  );
  return rows;
};

const getHospitalAppointments = async (hospitalId) => {
  const [rows] = await pool.execute(
    `SELECT a.*, u.name AS donor_name, u.phone AS donor_phone, d.blood_group, br.city
     FROM appointments a
     INNER JOIN users u ON u.id = a.donor_id
     INNER JOIN donors d ON d.user_id = a.donor_id
     INNER JOIN blood_requests br ON br.id = a.request_id
     WHERE a.hospital_id = ?
     ORDER BY a.slot_at ASC`,
    [hospitalId]
  );
  return rows;
};

module.exports = {
  createAppointment,
  updateAppointment,
  confirmAppointmentByHospital,
  updateAppointmentByHospital,
  getDonorAppointments,
  getHospitalAppointments,
  hasConflictingAppointment,
};
