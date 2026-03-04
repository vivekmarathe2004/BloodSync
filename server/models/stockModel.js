const pool = require("../config/db");

const nowTs = () => Math.floor(Date.now() / 1000);
const isMissingSchemaError = (error) => error && (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
const dayTextFromDate = (d) => d.toISOString().slice(0, 10);
const buildDailySeries = (days, rows) => {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Math.min(365, Number(days))) : 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byDay = new Map(
    (rows || []).map((r) => {
      const key = r.day_text instanceof Date ? dayTextFromDate(r.day_text) : String(r.day_text);
      return [key, Number(r.net_units_changed || 0)];
    })
  );

  const out = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayText = dayTextFromDate(d);
    out.push({
      day_text: dayText,
      net_units_changed: byDay.get(dayText) || 0,
    });
  }
  return out;
};

const getHospitalStock = async (hospitalId) => {
  const [rows] = await pool.execute(
    `SELECT id, hospital_id, blood_group, units_available, threshold_units, updated_at
     FROM blood_stock
     WHERE hospital_id = ?
     ORDER BY blood_group ASC`,
    [hospitalId]
  );
  return rows;
};

const getStockTransactions = async (hospitalId, limit = 100) => {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(5000, Number(limit))) : 100;
  const [rows] = await pool.execute(
    `SELECT id, blood_group, action_text, units_changed, units_before, units_after, notes_text, created_by_user_id, created_at_ts
     FROM stock_transactions
     WHERE hospital_id = ?
     ORDER BY created_at_ts DESC
     LIMIT ${safeLimit}`,
    [hospitalId]
  );
  return rows;
};

const getHospitalStockTrend = async (hospitalId, days = 30) => {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Math.min(365, Number(days))) : 30;
  const cutoffTs = nowTs() - safeDays * 24 * 60 * 60;
  try {
    const [rows] = await pool.execute(
      `SELECT DATE(FROM_UNIXTIME(created_at_ts)) AS day_text, COALESCE(SUM(units_changed), 0) AS net_units_changed
       FROM stock_transactions
       WHERE hospital_id = ?
         AND created_at_ts >= ?
       GROUP BY DATE(FROM_UNIXTIME(created_at_ts))
       ORDER BY day_text ASC`,
      [hospitalId, cutoffTs]
    );
    return buildDailySeries(safeDays, rows);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return buildDailySeries(safeDays, []);
    }
    throw error;
  }
};

const getSystemStockTrend = async (days = 30) => {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Math.min(365, Number(days))) : 30;
  const cutoffTs = nowTs() - safeDays * 24 * 60 * 60;
  try {
    const [rows] = await pool.execute(
      `SELECT DATE(FROM_UNIXTIME(created_at_ts)) AS day_text, COALESCE(SUM(units_changed), 0) AS net_units_changed
       FROM stock_transactions
       WHERE created_at_ts >= ?
       GROUP BY DATE(FROM_UNIXTIME(created_at_ts))
       ORDER BY day_text ASC`,
      [cutoffTs]
    );
    return buildDailySeries(safeDays, rows);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return buildDailySeries(safeDays, []);
    }
    throw error;
  }
};

const getHospitalStockTransactionsForExport = async (hospitalId, limit = 1000) => {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(50000, Number(limit))) : 1000;
  const [rows] = await pool.execute(
    `SELECT st.id, st.hospital_id, h.hospital_name, st.blood_group, st.action_text, st.units_changed, st.units_before, st.units_after,
            st.notes_text, st.created_by_user_id, st.created_at_ts
     FROM stock_transactions st
     INNER JOIN hospitals h ON h.user_id = st.hospital_id
     WHERE st.hospital_id = ?
     ORDER BY st.created_at_ts DESC
     LIMIT ${safeLimit}`,
    [hospitalId]
  );
  return rows;
};

const getSystemStockTransactionsForExport = async (limit = 5000) => {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100000, Number(limit))) : 5000;
  const [rows] = await pool.execute(
    `SELECT st.id, st.hospital_id, h.hospital_name, st.blood_group, st.action_text, st.units_changed, st.units_before, st.units_after,
            st.notes_text, st.created_by_user_id, st.created_at_ts
     FROM stock_transactions st
     INNER JOIN hospitals h ON h.user_id = st.hospital_id
     ORDER BY st.created_at_ts DESC
     LIMIT ${safeLimit}`
  );
  return rows;
};

const upsertHospitalStock = async ({ hospitalId, bloodGroup, unitsAvailable, thresholdUnits, createdByUserId, notesText }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.execute(
      "SELECT id, units_available, threshold_units FROM blood_stock WHERE hospital_id = ? AND blood_group = ? FOR UPDATE",
      [hospitalId, bloodGroup]
    );

    const unitsBefore = Number(existing?.units_available || 0);
    const unitsAfter = Math.max(0, Number(unitsAvailable || 0));
    const finalThreshold = Number(thresholdUnits != null ? thresholdUnits : existing?.threshold_units || 5);

    await connection.execute(
      `INSERT INTO blood_stock (hospital_id, blood_group, units_available, threshold_units)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE units_available = VALUES(units_available), threshold_units = VALUES(threshold_units)`,
      [hospitalId, bloodGroup, unitsAfter, finalThreshold]
    );

    await connection.execute(
      `INSERT INTO stock_transactions
       (hospital_id, blood_group, action_text, units_changed, units_before, units_after, notes_text, created_by_user_id, created_at_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hospitalId,
        bloodGroup,
        "set",
        unitsAfter - unitsBefore,
        unitsBefore,
        unitsAfter,
        notesText || "Manual stock set",
        createdByUserId || null,
        nowTs(),
      ]
    );

    await connection.commit();
    return { bloodGroup, unitsAvailable: unitsAfter, thresholdUnits: finalThreshold };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const adjustHospitalStock = async ({
  hospitalId,
  bloodGroup,
  deltaUnits,
  thresholdUnits,
  createdByUserId,
  notesText,
  allowFloorAtZero,
}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.execute(
      "SELECT id, units_available, threshold_units FROM blood_stock WHERE hospital_id = ? AND blood_group = ? FOR UPDATE",
      [hospitalId, bloodGroup]
    );

    const unitsBefore = Number(existing?.units_available || 0);
    let appliedDelta = Number(deltaUnits || 0);
    if (appliedDelta < 0 && unitsBefore + appliedDelta < 0) {
      if (!allowFloorAtZero) {
        throw new Error("Insufficient stock for deduction.");
      }
      appliedDelta = -unitsBefore;
    }

    const unitsAfter = Math.max(0, unitsBefore + appliedDelta);
    const finalThreshold = Number(thresholdUnits != null ? thresholdUnits : existing?.threshold_units || 5);

    await connection.execute(
      `INSERT INTO blood_stock (hospital_id, blood_group, units_available, threshold_units)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE units_available = VALUES(units_available), threshold_units = VALUES(threshold_units)`,
      [hospitalId, bloodGroup, unitsAfter, finalThreshold]
    );

    const actionText = appliedDelta >= 0 ? "add" : "deduct";
    await connection.execute(
      `INSERT INTO stock_transactions
       (hospital_id, blood_group, action_text, units_changed, units_before, units_after, notes_text, created_by_user_id, created_at_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hospitalId,
        bloodGroup,
        actionText,
        appliedDelta,
        unitsBefore,
        unitsAfter,
        notesText || (actionText === "add" ? "Stock added" : "Stock deducted"),
        createdByUserId || null,
        nowTs(),
      ]
    );

    await connection.commit();
    return { bloodGroup, unitsBefore, unitsAfter, appliedDelta, thresholdUnits: finalThreshold };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getHospitalStock,
  getStockTransactions,
  getHospitalStockTrend,
  getSystemStockTrend,
  getHospitalStockTransactionsForExport,
  getSystemStockTransactionsForExport,
  upsertHospitalStock,
  adjustHospitalStock,
};
