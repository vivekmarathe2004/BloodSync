const express = require("express");
const { body } = require("express-validator");
const {
  getProfile,
  patchProfile,
  createRequest,
  getDashboard,
  setRequestStatus,
  editRequest,
  cancelRequest,
  cloneRequestById,
  getMyRequests,
  sendBulkMessage,
  upsertStock,
  adjustStock,
  getStockTrend,
  exportStockTransactions,
  getDonorHistoryForApproval,
  confirmDonation,
  getAppointmentsForHospital,
  confirmAppointment,
  postAnnouncement,
} = require("../controllers/hospitalController");
const {
  createCampByOrganizer,
  getManagedCamps,
  patchCamp,
  deleteCamp,
  getCampMetrics,
  markCampDonorAttendance,
} = require("../controllers/campController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { handleValidation } = require("../middleware/validateMiddleware");
const { CITY_OPTIONS, BLOOD_GROUP_OPTIONS } = require("../constants/options");

const router = express.Router();

router.get("/profile", protect, allowRoles("hospital"), getProfile);
router.patch("/profile", protect, allowRoles("hospital"), patchProfile);
router.get("/dashboard", protect, allowRoles("hospital"), getDashboard);
router.post(
  "/requests",
  protect,
  allowRoles("hospital"),
  [
    body("bloodGroup").isIn(BLOOD_GROUP_OPTIONS),
    body("units").isInt({ min: 1 }),
    body("urgency").isIn(["normal", "urgent", "critical"]),
    body("city").isIn(CITY_OPTIONS),
  ],
  handleValidation,
  createRequest
);
router.patch("/requests/:requestId", protect, allowRoles("hospital"), editRequest);
router.patch("/requests/:requestId/status", protect, allowRoles("hospital"), setRequestStatus);
router.post("/requests/:requestId/cancel", protect, allowRoles("hospital"), cancelRequest);
router.post("/requests/:requestId/clone", protect, allowRoles("hospital"), cloneRequestById);
router.post("/requests/:requestId/repost", protect, allowRoles("hospital"), cloneRequestById);
router.post("/requests/:requestId/duplicate", protect, allowRoles("hospital"), cloneRequestById);
router.get("/requests", protect, allowRoles("hospital"), getMyRequests);
router.post("/bulk-message", protect, allowRoles("hospital"), sendBulkMessage);
router.post(
  "/stock",
  protect,
  allowRoles("hospital"),
  [body("bloodGroup").isIn(BLOOD_GROUP_OPTIONS), body("unitsAvailable").isInt({ min: 0 })],
  handleValidation,
  upsertStock
);
router.post(
  "/stock/adjust",
  protect,
  allowRoles("hospital"),
  [body("bloodGroup").isIn(BLOOD_GROUP_OPTIONS), body("deltaUnits").isInt({ min: -1000, max: 1000 }), body("deltaUnits").custom((v) => Number(v) !== 0)],
  handleValidation,
  adjustStock
);
router.get("/stock/trends", protect, allowRoles("hospital"), getStockTrend);
router.get("/stock/transactions/export", protect, allowRoles("hospital"), exportStockTransactions);
router.get("/donors/:donorId/history", protect, allowRoles("hospital"), getDonorHistoryForApproval);
router.post("/donations/confirm", protect, allowRoles("hospital"), confirmDonation);
router.get("/appointments", protect, allowRoles("hospital"), getAppointmentsForHospital);
router.patch("/appointments/:appointmentId", protect, allowRoles("hospital"), confirmAppointment);
router.post("/announcements", protect, allowRoles("hospital"), postAnnouncement);
router.get("/camps", protect, allowRoles("hospital"), getManagedCamps);
router.post("/camps", protect, allowRoles("hospital"), createCampByOrganizer);
router.patch("/camps/:campId", protect, allowRoles("hospital"), patchCamp);
router.post("/camps/:campId/cancel", protect, allowRoles("hospital"), deleteCamp);
router.delete("/camps/:campId", protect, allowRoles("hospital"), deleteCamp);
router.get("/camps/:campId/dashboard", protect, allowRoles("hospital"), getCampMetrics);
router.post("/camps/:campId/attendance", protect, allowRoles("hospital"), markCampDonorAttendance);

module.exports = router;
