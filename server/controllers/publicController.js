const pool = require("../config/db");
const { getLiveAvailability } = require("../models/donationModel");

const getLandingStats = async (req, res, next) => {
  try {
    const [[[donors]], [[donations]], [[requests]], availability] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS total_donors FROM donors"),
      pool.execute("SELECT COUNT(*) AS total_donations FROM donations WHERE status IN ('completed', 'pending')"),
      pool.execute(
        `SELECT COUNT(*) AS active_requests
         FROM blood_requests
         WHERE status IN ('active', 'pending', 'matched')`
      ),
      getLiveAvailability(),
    ]);

    return res.status(200).json({
      counters: {
        donors: Number(donors.total_donors || 0),
        donations: Number(donations.total_donations || 0),
        activeRequests: Number(requests.active_requests || 0),
      },
      bloodAvailability: availability,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getLandingStats };
