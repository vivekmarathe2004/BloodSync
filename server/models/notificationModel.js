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

const createNotification = async ({ userId, type, title, message, meta }) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, meta)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, meta ? JSON.stringify(meta) : null]
    );
  } catch (error) {
    if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
  }
};

const createBulkNotifications = async ({ userIds, type, title, message, meta }) => {
  if (!userIds.length) return;
  const values = userIds.map(() => "(?, ?, ?, ?, ?)").join(",");
  const params = [];
  userIds.forEach((userId) => {
    params.push(userId, type, title, message, meta ? JSON.stringify(meta) : null);
  });
  try {
    await pool.execute(`INSERT INTO notifications (user_id, type, title, message, meta) VALUES ${values}`, params);
  } catch (error) {
    if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
  }
};

const getNotifications = async (userId) => {
  let rows;
  try {
    [rows] = await pool.execute(
      `SELECT id, type, title, message, meta, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );
  } catch (error) {
    if (error && error.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
  return rows.map((row) => ({
    ...row,
    meta: parseJsonField(row.meta),
  }));
};

const markNotificationRead = async (notificationId, userId) => {
  let result;
  try {
    [result] = await pool.execute(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );
  } catch (error) {
    if (error && error.code === "ER_NO_SUCH_TABLE") return false;
    throw error;
  }
  return result.affectedRows > 0;
};

const markAllNotificationsRead = async (userId) => {
  let result;
  try {
    [result] = await pool.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId]);
  } catch (error) {
    if (error && error.code === "ER_NO_SUCH_TABLE") return 0;
    throw error;
  }
  return result.affectedRows;
};

const getUnreadNotificationCount = async (userId) => {
  let row;
  try {
    [[row]] = await pool.execute(
      "SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );
  } catch (error) {
    if (error && error.code === "ER_NO_SUCH_TABLE") return 0;
    throw error;
  }
  return row.unread_count;
};

module.exports = {
  createNotification,
  createBulkNotifications,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
};
