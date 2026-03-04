const express = require("express");
const { body } = require("express-validator");
const {
  getDashboard,
  respondToRequest,
  bookAppointmentSlot,
  rescheduleAppointment,
  cancelAppointment,
  getAppointments,
  submitQuestionnaire,
  submitDonationFeedback,
  getMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  updateProfile,
  exportDonationHistory,
  getDonationCertificate,
} = require("../controllers/donorController");
const { getPublicCamps, registerForCamp, cancelMyRegistration, getMyCampRegistrations } = require("../controllers/campController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { handleValidation } = require("../middleware/validateMiddleware");

const router = express.Router();

router.get("/dashboard", protect, allowRoles("donor"), getDashboard);
router.post("/requests/:requestId/respond", protect, allowRoles("donor"), respondToRequest);
router.post(
  "/appointments",
  protect,
  allowRoles("donor"),
  [body("requestId").isInt({ min: 1 }), body("slotAt").notEmpty()],
  handleValidation,
  bookAppointmentSlot
);
router.patch("/appointments/:appointmentId/reschedule", protect, allowRoles("donor"), rescheduleAppointment);
router.patch("/appointments/:appointmentId/cancel", protect, allowRoles("donor"), cancelAppointment);
router.get("/appointments", protect, allowRoles("donor"), getAppointments);
router.post("/questionnaire", protect, allowRoles("donor"), submitQuestionnaire);
router.post(
  "/feedback",
  protect,
  allowRoles("donor"),
  [body("hospitalId").isInt({ min: 1 }), body("rating").isInt({ min: 1, max: 5 })],
  handleValidation,
  submitDonationFeedback
);
router.get("/notifications", protect, allowRoles("donor"), getMyNotifications);
router.patch("/notifications/:notificationId/read", protect, allowRoles("donor"), markMyNotificationRead);
router.patch("/notifications/read-all", protect, allowRoles("donor"), markAllMyNotificationsRead);
router.patch("/profile", protect, allowRoles("donor"), updateProfile);
router.get("/history/export", protect, allowRoles("donor"), exportDonationHistory);
router.get("/certificate/:donationId", protect, allowRoles("donor"), getDonationCertificate);
router.get("/camps/upcoming", protect, allowRoles("donor"), getPublicCamps);
router.post("/camps/:campId/register", protect, allowRoles("donor"), registerForCamp);
router.patch("/camps/:campId/cancel", protect, allowRoles("donor"), cancelMyRegistration);
router.get("/camps/registrations", protect, allowRoles("donor"), getMyCampRegistrations);

module.exports = router;
