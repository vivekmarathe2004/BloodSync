const pool = require("../config/db");

const nowTs = () => Math.floor(Date.now() / 1000);

const createCamp = async (payload) => {
  const ts = nowTs();
  const startDate = payload.startDate || payload.date;
  const endDate = payload.endDate || startDate;
  const [result] = await pool.execute(
    `INSERT INTO camps
     (camp_name, location_text, camp_date_text, start_date_text, end_date_text, start_time_text, end_time_text, organizer_user_id, organizer_role_text,
      description_text, expected_donors, status_text, created_at_ts, updated_at_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.campName,
      payload.location,
      startDate,
      startDate,
      endDate,
      payload.startTime,
      payload.endTime,
      payload.organizerUserId,
      payload.organizerRole,
      payload.description || "",
      Number(payload.expectedDonors || 0),
      payload.status || "upcoming",
      ts,
      ts,
    ]
  );
  return result.insertId;
};

const listPublicUpcomingCamps = async () => {
  const [rows] = await pool.execute(
    `SELECT c.id, c.camp_name, c.location_text,
            COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) AS start_date_text,
            COALESCE(NULLIF(c.end_date_text, ''), COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text)) AS end_date_text,
            COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) AS camp_date_text,
            c.start_time_text, c.end_time_text,
            c.description_text, c.expected_donors, c.status_text, c.organizer_role_text,
            u.name AS organizer_name,
            COALESCE(SUM(CASE WHEN cr.status_text = 'registered' THEN 1 ELSE 0 END), 0) AS registered_count,
            GREATEST(c.expected_donors - COALESCE(SUM(CASE WHEN cr.status_text = 'registered' THEN 1 ELSE 0 END), 0), 0) AS available_slots
     FROM camps c
     INNER JOIN users u ON u.id = c.organizer_user_id
     LEFT JOIN camp_registrations cr ON cr.camp_id = c.id
     WHERE c.status_text IN ('upcoming', 'ongoing')
     GROUP BY c.id, c.camp_name, c.location_text, c.camp_date_text, c.start_date_text, c.end_date_text, c.start_time_text, c.end_time_text,
              c.description_text, c.expected_donors, c.status_text, c.organizer_role_text, u.name
     ORDER BY COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) ASC, c.start_time_text ASC`
  );
  return rows;
};

const listManagedCamps = async (role, userId) => {
  const [rows] = await pool.execute(
    `SELECT c.*,
            COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) AS start_date_text_fallback,
            COALESCE(NULLIF(c.end_date_text, ''), COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text)) AS end_date_text_fallback,
            u.name AS organizer_name
     FROM camps c
     INNER JOIN users u ON u.id = c.organizer_user_id
     WHERE c.status_text <> 'cancelled'
     ORDER BY c.created_at_ts DESC`,
    []
  );
  return rows;
};

const getCampById = async (campId) => {
  const [rows] = await pool.execute("SELECT * FROM camps WHERE id = ? LIMIT 1", [campId]);
  return rows[0];
};

const updateCamp = async (campId, payload) => {
  const ts = nowTs();
  const startDate = payload.startDate || payload.date;
  const endDate = payload.endDate || payload.date || payload.startDate;
  const [result] = await pool.execute(
    `UPDATE camps
     SET camp_name = COALESCE(?, camp_name),
         location_text = COALESCE(?, location_text),
         camp_date_text = COALESCE(?, camp_date_text),
         start_date_text = COALESCE(?, start_date_text),
         end_date_text = COALESCE(?, end_date_text),
         start_time_text = COALESCE(?, start_time_text),
         end_time_text = COALESCE(?, end_time_text),
         description_text = COALESCE(?, description_text),
         expected_donors = COALESCE(?, expected_donors),
         status_text = COALESCE(?, status_text),
         updated_at_ts = ?
     WHERE id = ?`,
    [
      payload.campName || null,
      payload.location || null,
      startDate || null,
      startDate || null,
      endDate || null,
      payload.startTime || null,
      payload.endTime || null,
      payload.description || null,
      payload.expectedDonors != null ? Number(payload.expectedDonors) : null,
      payload.status || null,
      ts,
      campId,
    ]
  );
  return result.affectedRows > 0;
};

const cancelCamp = async (campId) => updateCamp(campId, { status: "cancelled" });

const registerDonorForCamp = async (campId, donorUserId) => {
  const ts = nowTs();
  await pool.execute(
    `INSERT INTO camp_registrations (camp_id, donor_user_id, status_text, created_at_ts, updated_at_ts)
     VALUES (?, ?, 'registered', ?, ?)
     ON DUPLICATE KEY UPDATE status_text = 'registered', updated_at_ts = VALUES(updated_at_ts)`,
    [campId, donorUserId, ts, ts]
  );
};

const cancelDonorCampRegistration = async (campId, donorUserId) => {
  const ts = nowTs();
  const [result] = await pool.execute(
    `UPDATE camp_registrations
     SET status_text = 'cancelled', updated_at_ts = ?
     WHERE camp_id = ? AND donor_user_id = ?`,
    [ts, campId, donorUserId]
  );
  return result.affectedRows > 0;
};

const getDonorCampHistory = async (donorUserId) => {
  const [rows] = await pool.execute(
    `SELECT cr.id, cr.status_text, cr.created_at_ts, c.id AS camp_id, c.camp_name, c.location_text,
            COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) AS start_date_text,
            COALESCE(NULLIF(c.end_date_text, ''), COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text)) AS end_date_text,
            COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) AS camp_date_text,
            c.start_time_text, c.end_time_text, c.status_text AS camp_status
     FROM camp_registrations cr
     INNER JOIN camps c ON c.id = cr.camp_id
     WHERE cr.donor_user_id = ?
     ORDER BY COALESCE(NULLIF(c.start_date_text, ''), c.camp_date_text) DESC, c.start_time_text DESC`,
    [donorUserId]
  );
  return rows;
};

const markAttendance = async ({ campId, donorUserId, arrivedFlag, donatedFlag, unitsCollected, markedByUserId }) => {
  const ts = nowTs();
  await pool.execute(
    `INSERT INTO camp_attendance (camp_id, donor_user_id, arrived_flag, donated_flag, units_collected, marked_by_user_id, marked_at_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE arrived_flag = VALUES(arrived_flag), donated_flag = VALUES(donated_flag),
       units_collected = VALUES(units_collected), marked_by_user_id = VALUES(marked_by_user_id), marked_at_ts = VALUES(marked_at_ts)`,
    [campId, donorUserId, arrivedFlag ? 1 : 0, donatedFlag ? 1 : 0, Number(unitsCollected || 0), markedByUserId, ts]
  );

  if (donatedFlag) {
    const donationDate = new Date().toISOString().slice(0, 10);
    await pool.execute(
      `INSERT INTO camp_donations (camp_id, donor_id, units, donation_date_text, status_text, created_at_ts)
       VALUES (?, ?, ?, ?, 'completed', ?)
       ON DUPLICATE KEY UPDATE units = VALUES(units), donation_date_text = VALUES(donation_date_text), created_at_ts = VALUES(created_at_ts)`,
      [campId, donorUserId, Number(unitsCollected || 1), donationDate, ts]
    );
  }
};

const getCampDashboard = async (campId) => {
  const [[camp]] = await pool.execute("SELECT * FROM camps WHERE id = ? LIMIT 1", [campId]);
  if (!camp) return null;

  const [[registrations]] = await pool.execute(
    `SELECT COUNT(*) AS total_registered
     FROM camp_registrations
     WHERE camp_id = ? AND status_text = 'registered'`,
    [campId]
  );
  const [[attendance]] = await pool.execute(
    `SELECT
      COALESCE(SUM(CASE WHEN arrived_flag = 1 THEN 1 ELSE 0 END), 0) AS checked_in,
      COALESCE(SUM(CASE WHEN donated_flag = 1 THEN units_collected ELSE 0 END), 0) AS total_units_collected
     FROM camp_attendance
     WHERE camp_id = ?`,
    [campId]
  );
  const noShows = Math.max(Number(registrations.total_registered || 0) - Number(attendance.checked_in || 0), 0);

  const [donors] = await pool.execute(
    `SELECT cr.donor_user_id, u.name, u.email, cr.status_text, ca.arrived_flag, ca.donated_flag, ca.units_collected
     FROM camp_registrations cr
     INNER JOIN users u ON u.id = cr.donor_user_id
     LEFT JOIN camp_attendance ca ON ca.camp_id = cr.camp_id AND ca.donor_user_id = cr.donor_user_id
     WHERE cr.camp_id = ?
     ORDER BY cr.created_at_ts DESC`,
    [campId]
  );

  return {
    camp,
    metrics: {
      totalRegisteredDonors: Number(registrations.total_registered || 0),
      checkedInDonors: Number(attendance.checked_in || 0),
      totalUnitsCollected: Number(attendance.total_units_collected || 0),
      noShows,
    },
    donors,
  };
};

const getCampAnalytics = async () => {
  const [[totals]] = await pool.execute(
    `SELECT COUNT(*) AS total_camps
     FROM camps`
  );
  const [[units]] = await pool.execute(
    `SELECT COALESCE(SUM(units), 0) AS total_units_collected
     FROM camp_donations`
  );
  const [[location]] = await pool.execute(
    `SELECT location_text, COUNT(*) AS count
     FROM camps
     GROUP BY location_text
     ORDER BY count DESC
     LIMIT 1`
  );
  const [[attendance]] = await pool.execute(
    `SELECT
      COALESCE(SUM(CASE WHEN cr.status_text = 'registered' THEN 1 ELSE 0 END), 0) AS registered,
      COALESCE(SUM(CASE WHEN ca.arrived_flag = 1 THEN 1 ELSE 0 END), 0) AS arrived
     FROM camp_registrations cr
     LEFT JOIN camp_attendance ca ON ca.camp_id = cr.camp_id AND ca.donor_user_id = cr.donor_user_id`
  );

  const registered = Number(attendance.registered || 0);
  const arrived = Number(attendance.arrived || 0);
  const avgAttendanceRate = registered > 0 ? Number(((arrived / registered) * 100).toFixed(2)) : 0;

  return {
    totalCampsConducted: Number(totals.total_camps || 0),
    totalBloodUnitsCollectedFromCamps: Number(units.total_units_collected || 0),
    mostActiveCampLocation: location?.location_text || "N/A",
    averageAttendanceRate: avgAttendanceRate,
  };
};

module.exports = {
  createCamp,
  listPublicUpcomingCamps,
  listManagedCamps,
  getCampById,
  updateCamp,
  cancelCamp,
  registerDonorForCamp,
  cancelDonorCampRegistration,
  getDonorCampHistory,
  markAttendance,
  getCampDashboard,
  getCampAnalytics,
};
