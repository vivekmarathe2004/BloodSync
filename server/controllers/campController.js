const { logActivity } = require("../models/activityModel");
const {
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
} = require("../models/campModel");

const parseDateText = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const validateCampDateRange = (startDateText, endDateText) => {
  const start = parseDateText(startDateText);
  const end = parseDateText(endDateText);
  if (!start || !end) return { valid: false, message: "Dates must be in YYYY-MM-DD format." };
  if (end < start) return { valid: false, message: "End date cannot be before start date." };
  const dayMs = 24 * 60 * 60 * 1000;
  const durationDays = Math.floor((end - start) / dayMs) + 1;
  if (durationDays > 14) return { valid: false, message: "Camp duration cannot exceed 14 days." };
  return { valid: true, durationDays };
};

const getPublicCamps = async (req, res, next) => {
  try {
    const camps = await listPublicUpcomingCamps();
    return res.status(200).json(camps);
  } catch (error) {
    return next(error);
  }
};

const createCampByOrganizer = async (req, res, next) => {
  try {
    const { campName, location, startDate, endDate, date, startTime, endTime, description, expectedDonors, status } = req.body;
    const finalStartDate = startDate || date;
    const finalEndDate = endDate || finalStartDate;
    if (!campName || !location || !finalStartDate || !finalEndDate || !startTime || !endTime) {
      return res.status(400).json({ message: "Camp name, location, start date, end date, start time and end time are required." });
    }

    const dateRangeValidation = validateCampDateRange(finalStartDate, finalEndDate);
    if (!dateRangeValidation.valid) {
      return res.status(400).json({ message: dateRangeValidation.message });
    }

    const id = await createCamp({
      campName,
      location,
      startDate: finalStartDate,
      endDate: finalEndDate,
      startTime,
      endTime,
      organizerUserId: req.user.id,
      organizerRole: req.user.role,
      description,
      expectedDonors,
      status,
    });

    await logActivity({
      actorUserId: req.user.id,
      action: "camp_created",
      entityType: "camp",
      entityId: id,
      details: { campName, startDate: finalStartDate, endDate: finalEndDate, location, durationDays: dateRangeValidation.durationDays },
    });

    return res.status(201).json({ message: "Camp created.", id });
  } catch (error) {
    return next(error);
  }
};

const getManagedCamps = async (req, res, next) => {
  try {
    const camps = await listManagedCamps(req.user.role, req.user.id);
    return res.status(200).json(camps);
  } catch (error) {
    return next(error);
  }
};

const patchCamp = async (req, res, next) => {
  try {
    const campId = Number(req.params.campId);
    const camp = await getCampById(campId);
    if (!camp) return res.status(404).json({ message: "Camp not found." });

    const startDateInput = req.body.startDate || req.body.date || camp.start_date_text || camp.camp_date_text;
    const endDateInput = req.body.endDate || req.body.date || req.body.startDate || camp.end_date_text || startDateInput;
    const dateRangeValidation = validateCampDateRange(startDateInput, endDateInput);
    if (!dateRangeValidation.valid) {
      return res.status(400).json({ message: dateRangeValidation.message });
    }

    const updated = await updateCamp(campId, req.body);
    if (!updated) return res.status(404).json({ message: "Camp not found." });

    await logActivity({
      actorUserId: req.user.id,
      action: "camp_updated",
      entityType: "camp",
      entityId: campId,
      details: req.body,
    });

    return res.status(200).json({ message: "Camp updated." });
  } catch (error) {
    return next(error);
  }
};

const deleteCamp = async (req, res, next) => {
  try {
    const campId = Number(req.params.campId);
    const camp = await getCampById(campId);
    if (!camp) return res.status(404).json({ message: "Camp not found." });

    await cancelCamp(campId);
    await logActivity({
      actorUserId: req.user.id,
      action: "camp_cancelled",
      entityType: "camp",
      entityId: campId,
    });

    return res.status(200).json({ message: "Camp cancelled." });
  } catch (error) {
    return next(error);
  }
};

const registerForCamp = async (req, res, next) => {
  try {
    const campId = Number(req.params.campId);
    const camp = await getCampById(campId);
    if (!camp) return res.status(404).json({ message: "Camp not found." });
    if (camp.status_text === "cancelled" || camp.status_text === "completed") {
      return res.status(400).json({ message: "Camp is not open for registration." });
    }
    const dashboard = await getCampDashboard(campId);
    if (dashboard && Number(camp.expected_donors || 0) > 0 && Number(dashboard.metrics.totalRegisteredDonors || 0) >= Number(camp.expected_donors)) {
      return res.status(400).json({ message: "Camp is full." });
    }

    await registerDonorForCamp(campId, req.user.id);
    await logActivity({
      actorUserId: req.user.id,
      action: "camp_registered",
      entityType: "camp",
      entityId: campId,
    });
    return res.status(200).json({ message: "Registered for camp." });
  } catch (error) {
    return next(error);
  }
};

const cancelMyRegistration = async (req, res, next) => {
  try {
    const campId = Number(req.params.campId);
    const cancelled = await cancelDonorCampRegistration(campId, req.user.id);
    if (!cancelled) return res.status(404).json({ message: "Registration not found." });
    await logActivity({
      actorUserId: req.user.id,
      action: "camp_registration_cancelled",
      entityType: "camp",
      entityId: campId,
    });
    return res.status(200).json({ message: "Camp registration cancelled." });
  } catch (error) {
    return next(error);
  }
};

const getMyCampRegistrations = async (req, res, next) => {
  try {
    const rows = await getDonorCampHistory(req.user.id);
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const getCampMetrics = async (req, res, next) => {
  try {
    const campId = Number(req.params.campId);
    const dashboard = await getCampDashboard(campId);
    if (!dashboard) return res.status(404).json({ message: "Camp not found." });
    return res.status(200).json(dashboard);
  } catch (error) {
    return next(error);
  }
};

const markCampDonorAttendance = async (req, res, next) => {
  try {
    const campId = Number(req.params.campId);
    const camp = await getCampById(campId);
    if (!camp) return res.status(404).json({ message: "Camp not found." });

    const donorUserId = Number(req.body.donorUserId);
    if (!donorUserId) return res.status(400).json({ message: "donorUserId is required." });

    await markAttendance({
      campId,
      donorUserId,
      arrivedFlag: req.body.arrivedFlag === true || req.body.arrivedFlag === 1,
      donatedFlag: req.body.donatedFlag === true || req.body.donatedFlag === 1,
      unitsCollected: req.body.unitsCollected,
      markedByUserId: req.user.id,
    });

    await logActivity({
      actorUserId: req.user.id,
      action: "camp_attendance_marked",
      entityType: "camp",
      entityId: campId,
      details: { donorUserId, arrivedFlag: req.body.arrivedFlag, donatedFlag: req.body.donatedFlag },
    });
    return res.status(200).json({ message: "Attendance updated." });
  } catch (error) {
    return next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await getCampAnalytics();
    return res.status(200).json(analytics);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPublicCamps,
  createCampByOrganizer,
  getManagedCamps,
  patchCamp,
  deleteCamp,
  registerForCamp,
  cancelMyRegistration,
  getMyCampRegistrations,
  getCampMetrics,
  markCampDonorAttendance,
  getAnalytics,
};
