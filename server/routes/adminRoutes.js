const express = require("express");
const {
  getDashboard,
  addAdmin,
  deleteUser,
  setUserBanStatus,
  setUserRestriction,
  changeUserRole,
  bulkUserAction,
  getAllRequests,
  getDonationHistory,
  getSystemActivity,
  exportSystemReport,
  createAnnouncement,
  getStockTrend,
  exportStockTransactions,
} = require("../controllers/adminController");
const {
  createCampByOrganizer,
  getManagedCamps,
  patchCamp,
  deleteCamp,
  getCampMetrics,
  markCampDonorAttendance,
  getAnalytics,
} = require("../controllers/campController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/dashboard", protect, allowRoles("admin"), getDashboard);
router.post("/users/admin", protect, allowRoles("admin"), addAdmin);
router.delete("/users/:id", protect, allowRoles("admin"), deleteUser);
router.patch("/users/:id/status", protect, allowRoles("admin"), setUserBanStatus);
router.patch("/users/:id/restriction", protect, allowRoles("admin"), setUserRestriction);
router.patch("/users/:id/role", protect, allowRoles("admin"), changeUserRole);
router.post("/users/bulk-action", protect, allowRoles("admin"), bulkUserAction);
router.get("/requests", protect, allowRoles("admin"), getAllRequests);
router.get("/history", protect, allowRoles("admin"), getDonationHistory);
router.get("/activity", protect, allowRoles("admin"), getSystemActivity);
router.get("/reports/export", protect, allowRoles("admin"), exportSystemReport);
router.get("/stock/trends", protect, allowRoles("admin"), getStockTrend);
router.get("/stock/transactions/export", protect, allowRoles("admin"), exportStockTransactions);
router.post("/announcements", protect, allowRoles("admin"), createAnnouncement);
router.get("/camps", protect, allowRoles("admin"), getManagedCamps);
router.post("/camps", protect, allowRoles("admin"), createCampByOrganizer);
router.patch("/camps/:campId", protect, allowRoles("admin"), patchCamp);
router.post("/camps/:campId/cancel", protect, allowRoles("admin"), deleteCamp);
router.delete("/camps/:campId", protect, allowRoles("admin"), deleteCamp);
router.get("/camps/:campId/dashboard", protect, allowRoles("admin"), getCampMetrics);
router.post("/camps/:campId/attendance", protect, allowRoles("admin"), markCampDonorAttendance);
router.get("/camps-analytics", protect, allowRoles("admin"), getAnalytics);

module.exports = router;
