const pool = require("../config/db");

const getGlobalStats = async (dateFrom = "", dateTo = "") => {
  const filters = [];
  const params = [];
  if (dateFrom) {
    filters.push("DATE(created_at) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("DATE(created_at) <= ?");
    params.push(dateTo);
  }

  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const [[users]] = await pool.execute("SELECT COUNT(*) AS total_users FROM users");
  const [[donors]] = await pool.execute("SELECT COUNT(*) AS total_donors FROM donors");
  const [[hospitals]] = await pool.execute("SELECT COUNT(*) AS total_hospitals FROM hospitals");
  const [[requests]] = await pool.execute(`SELECT COUNT(*) AS total_requests FROM blood_requests${where}`, params);
  return {
    ...users,
    ...donors,
    ...hospitals,
    ...requests,
  };
};

const getBloodGroupDistribution = async () => {
  const [rows] = await pool.execute(
    "SELECT blood_group, COUNT(*) AS count FROM donors GROUP BY blood_group ORDER BY count DESC"
  );
  return rows;
};

const getCityDistribution = async () => {
  const [rows] = await pool.execute(
    "SELECT city, COUNT(*) AS count FROM users WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 8"
  );
  return rows;
};

const getDemandHeatmap = async () => {
  const [rows] = await pool.execute(
    `SELECT city, blood_group, COUNT(*) AS demand_count
     FROM blood_requests
     WHERE status IN ('pending', 'matched')
     GROUP BY city, blood_group
     ORDER BY demand_count DESC`
  );
  return rows;
};

const getLiveAvailability = async () => {
  const [rows] = await pool.execute(
    `SELECT d.blood_group, COUNT(*) AS available_donors
     FROM donors d
     WHERE d.eligible_status = 1
     GROUP BY d.blood_group
     ORDER BY d.blood_group`
  );
  return rows;
};

module.exports = {
  getGlobalStats,
  getBloodGroupDistribution,
  getCityDistribution,
  getDemandHeatmap,
  getLiveAvailability,
};
