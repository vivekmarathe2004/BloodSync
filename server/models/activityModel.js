const pool = require("../config/db");
const parseJsonField = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }
  return null;
};

const logActivity = async ({ actorUserId, action, entityType, entityId, details }) => {
  const params = [actorUserId || null, action, entityType || null, entityId || null, details ? JSON.stringify(details) : null];
  try {
    await pool.execute(
      `INSERT INTO activity_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      params
    );
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      await pool.execute(
        `INSERT INTO activity_logs (actor_user_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [actorUserId || null, action, entityType || null, entityId || null]
      );
      return;
    }
    if (error && error.code === "ER_NO_SUCH_TABLE") {
      return;
    }
    throw error;
  }
};

const getActivityTimeline = async (limit = 100) => {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(1000, Number(limit))) : 100;
  try {
    const [rows] = await pool.execute(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at, u.name AS actor_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       ORDER BY al.created_at DESC
       LIMIT ${safeLimit}`
    );
    return rows.map((row) => {
      return {
        ...row,
        details: parseJsonField(row.details),
      };
    });
  } catch (error) {
    if (error && (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR")) {
      return [];
    }
    throw error;
  }
};

module.exports = {
  logActivity,
  getActivityTimeline,
};
