const {
  getHospitalByUserId,
  updateHospitalProfile,
  getHospitalRequests,
  getMatchedDonors,
  getDonorHistory,
} = require("../models/hospitalModel");
const {
  createBloodRequest,
  findDuplicateOpenRequest,
  updateRequestStatus,
  updateRequestStatusForHospital,
  updateBloodRequestForHospital,
  cloneRequest,
  expireOldRequests,
  getRequestsForHospital,
} = require("../models/requestModel");
const { createNotification, createBulkNotifications, getNotifications } = require("../models/notificationModel");
const { updateAppointmentByHospital, getHospitalAppointments } = require("../models/appointmentModel");
const { logActivity } = require("../models/activityModel");
const {
  getHospitalStock,
  getStockTransactions,
  getHospitalStockTrend,
  getHospitalStockTransactionsForExport,
  upsertHospitalStock,
  adjustHospitalStock,
} = require("../models/stockModel");
const pool = require("../config/db");

const apiToDbRequestStatus = {
  open: "pending",
  pending: "pending",
  matched: "matched",
  partially_fulfilled: "matched",
  completed: "completed",
  cancelled: "cancelled",
  expired: "expired",
};

const dbToApiRequestStatus = (status) => (status === "pending" ? "open" : status || "open");
const withApiRequestStatus = (row) => ({ ...row, status_api: dbToApiRequestStatus(row.status) });

const getProfile = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) return res.status(404).json({ message: "Hospital profile not found." });
    return res.status(200).json(hospital);
  } catch (error) {
    return next(error);
  }
};

const patchProfile = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) return res.status(404).json({ message: "Hospital profile not found." });

    await updateHospitalProfile(req.user.id, req.body || {});
    const updated = await getHospitalByUserId(req.user.id);

    await logActivity({
      actorUserId: req.user.id,
      action: "hospital_profile_updated",
      entityType: "hospital",
      entityId: req.user.id,
      details: req.body || {},
    });
    return res.status(200).json({ message: "Hospital profile updated.", hospital: updated });
  } catch (error) {
    return next(error);
  }
};

const createRequest = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital profile not found." });
    }

    const duplicate = await findDuplicateOpenRequest({
      hospitalId: hospital.user_id,
      bloodGroup: req.body.bloodGroup,
      city: req.body.city,
    });
    if (duplicate) {
      return res.status(409).json({ message: "Duplicate open request exists.", requestId: duplicate.id });
    }

    const requestId = await createBloodRequest({
      hospitalId: hospital.user_id,
      bloodGroup: req.body.bloodGroup,
      units: req.body.units,
      urgency: req.body.urgency,
      city: req.body.city,
      requestType: req.body.requestType || (req.body.urgency === "critical" ? "emergency" : "normal"),
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      requiredByDate: req.body.requiredByDate || null,
      notesText: req.body.notes || req.body.notesText || null,
    });

    await logActivity({
      actorUserId: req.user.id,
      action: "request_created",
      entityType: "blood_request",
      entityId: requestId,
      details: req.body,
    });

    return res.status(201).json({ message: "Blood request created.", requestId });
  } catch (error) {
    return next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    await expireOldRequests();
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital profile not found." });
    }

    const requestsRaw = await getHospitalRequests(hospital.user_id);
    const requests = requestsRaw.map(withApiRequestStatus);
    const latest = requestsRaw[0];
    const matchedDonors = latest
      ? await getMatchedDonors(
          latest.city,
          latest.blood_group,
          hospital.latitude,
          hospital.longitude,
          req.query.maxDistanceKm ? Number(req.query.maxDistanceKm) : null
        )
      : [];
    let notifications = [];
    try {
      notifications = await getNotifications(req.user.id);
    } catch (error) {
      if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
    }

    let stock = [];
    try {
      stock = await getHospitalStock(hospital.user_id);
    } catch (error) {
      if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
    }

    let stockTransactions = [];
    try {
      stockTransactions = await getStockTransactions(hospital.user_id, 50);
    } catch (error) {
      if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
    }

    const [[activeRequestsCountRow]] = await pool.execute(
      `SELECT COUNT(*) AS count
       FROM blood_requests
       WHERE hospital_id = ?
         AND status IN ('pending', 'matched')`,
      [hospital.user_id]
    );
    let donationsRow = { total_donations: 0, total_units: 0 };
    try {
      [[donationsRow]] = await pool.execute(
        `SELECT COUNT(*) AS total_donations, COALESCE(SUM(units), 0) AS total_units
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         WHERE br.hospital_id = ?
           AND d.status = 'completed'`,
        [hospital.user_id]
      );
    } catch (error) {
      if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
      [[donationsRow]] = await pool.execute(
        `SELECT COUNT(*) AS total_donations, COUNT(*) AS total_units
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         WHERE br.hospital_id = ?
           AND d.status = 'completed'`,
        [hospital.user_id]
      );
    }

    let monthlyUnitsRow = { monthly_units: 0 };
    try {
      [[monthlyUnitsRow]] = await pool.execute(
        `SELECT COALESCE(SUM(d.units), 0) AS monthly_units
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         WHERE br.hospital_id = ?
           AND d.status = 'completed'
           AND YEAR(d.donation_date) = YEAR(CURDATE())
           AND MONTH(d.donation_date) = MONTH(CURDATE())`,
        [hospital.user_id]
      );
    } catch (error) {
      if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
      [[monthlyUnitsRow]] = await pool.execute(
        `SELECT COUNT(*) AS monthly_units
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         WHERE br.hospital_id = ?
           AND d.status = 'completed'
           AND YEAR(d.donation_date) = YEAR(CURDATE())
           AND MONTH(d.donation_date) = MONTH(CURDATE())`,
        [hospital.user_id]
      );
    }

    let emergencyRow = { count: 0 };
    try {
      [[emergencyRow]] = await pool.execute(
        `SELECT COUNT(*) AS count
         FROM blood_requests
         WHERE hospital_id = ?
           AND request_type = 'emergency'
           AND status IN ('pending', 'matched')`,
        [hospital.user_id]
      );
    } catch (error) {
      if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
      [[emergencyRow]] = await pool.execute(
        `SELECT COUNT(*) AS count
         FROM blood_requests
         WHERE hospital_id = ?
           AND urgency = 'critical'
           AND status IN ('pending', 'matched', 'active')`,
        [hospital.user_id]
      );
    }
    const [demandDistribution] = await pool.execute(
      `SELECT blood_group, COUNT(*) AS count
       FROM blood_requests
       WHERE hospital_id = ?
       GROUP BY blood_group
       ORDER BY count DESC`,
      [hospital.user_id]
    );
    let donationTrend = [];
    try {
      [donationTrend] = await pool.execute(
        `SELECT DATE_FORMAT(donation_date, '%Y-%m') AS month, COALESCE(SUM(units), 0) AS units
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         WHERE br.hospital_id = ?
           AND d.status = 'completed'
           AND donation_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(donation_date, '%Y-%m')
         ORDER BY month ASC`,
        [hospital.user_id]
      );
    } catch (error) {
      if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
      [donationTrend] = await pool.execute(
        `SELECT DATE_FORMAT(donation_date, '%Y-%m') AS month, COUNT(*) AS units
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         WHERE br.hospital_id = ?
           AND d.status = 'completed'
           AND donation_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(donation_date, '%Y-%m')
         ORDER BY month ASC`,
        [hospital.user_id]
      );
    }

    const lowStockAlerts = stock.filter((s) => Number(s.units_available) <= Number(s.threshold_units));
    const urgentRequests = requests.filter((r) => r.urgency === "critical" && ["open", "matched"].includes(r.status_api));

    return res.status(200).json({
      hospital,
      requests,
      matchedDonors,
      stock,
      stockTransactions,
      lowStockAlerts,
      notifications,
      analytics: {
        activeRequestsCount: Number(activeRequestsCountRow?.count || 0),
        totalDonationsReceived: Number(donationsRow?.total_donations || 0),
        monthlyUnitsCollected: Number(monthlyUnitsRow?.monthly_units || 0),
        emergencyRequestsCount: Number(emergencyRow?.count || 0),
        bloodGroupDemandDistribution: demandDistribution,
        donationTrend,
        requestFulfillmentPercentage:
          requests.length > 0
            ? Number(((requests.filter((r) => r.status_api === "completed").length / requests.length) * 100).toFixed(2))
            : 0,
      },
      urgentAttention: {
        criticalOpenRequests: urgentRequests,
        lowStockAlerts,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const setRequestStatus = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) return res.status(404).json({ message: "Hospital profile not found." });

    const requestedStatus = String(req.body.status || "").toLowerCase();
    const mapped = apiToDbRequestStatus[requestedStatus];
    if (!mapped) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const updated = await updateRequestStatusForHospital(Number(req.params.requestId), hospital.user_id, mapped);
    if (!updated) {
      return res.status(404).json({ message: "Request not found." });
    }
    return res.status(200).json({ message: "Request status updated.", status: dbToApiRequestStatus(mapped) });
  } catch (error) {
    return next(error);
  }
};

const editRequest = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) return res.status(404).json({ message: "Hospital profile not found." });
    const updated = await updateBloodRequestForHospital(Number(req.params.requestId), hospital.user_id, req.body || {});
    if (!updated) {
      return res.status(404).json({ message: "Request not found or nothing to update." });
    }
    return res.status(200).json({ message: "Request updated." });
  } catch (error) {
    return next(error);
  }
};

const cancelRequest = async (req, res, next) => {
  req.body.status = "cancelled";
  return setRequestStatus(req, res, next);
};

const cloneRequestById = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital profile not found." });
    }
    const newId = await cloneRequest(Number(req.params.requestId), hospital.user_id);
    if (!newId) {
      return res.status(404).json({ message: "Request not found." });
    }
    return res.status(201).json({ message: "Request cloned.", requestId: newId });
  } catch (error) {
    return next(error);
  }
};

const getMyRequests = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    if (!hospital) return res.status(404).json({ message: "Hospital profile not found." });
    const rows = await getRequestsForHospital(hospital.user_id);
    return res.status(200).json(rows.map(withApiRequestStatus));
  } catch (error) {
    return next(error);
  }
};

const sendBulkMessage = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    const { city, bloodGroup, message } = req.body;
    const [donors] = await pool.execute(
      `SELECT d.user_id
       FROM donors d
       INNER JOIN users u ON u.id = d.user_id
       WHERE d.eligible_status = 1
         AND (? IS NULL OR u.city = ?)
         AND (? IS NULL OR d.blood_group = ?)`,
      [city || null, city || null, bloodGroup || null, bloodGroup || null]
    );

    await createBulkNotifications({
      userIds: donors.map((d) => d.user_id),
      type: "bulk_message",
      title: `Message from ${hospital.hospital_name}`,
      message,
      meta: { hospitalId: hospital.user_id, city, bloodGroup },
    });

    return res.status(200).json({ message: "Bulk message sent.", recipients: donors.length });
  } catch (error) {
    return next(error);
  }
};

const upsertStock = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    const { bloodGroup, unitsAvailable, thresholdUnits } = req.body;
    await upsertHospitalStock({
      hospitalId: hospital.user_id,
      bloodGroup,
      unitsAvailable,
      thresholdUnits: thresholdUnits || 5,
      createdByUserId: req.user.id,
      notesText: "Manual stock update",
    });
    await logActivity({
      actorUserId: req.user.id,
      action: "stock_set",
      entityType: "stock",
      entityId: null,
      details: { bloodGroup, unitsAvailable, thresholdUnits: thresholdUnits || 5 },
    });
    return res.status(200).json({ message: "Stock updated." });
  } catch (error) {
    return next(error);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    const { bloodGroup, deltaUnits, thresholdUnits, notesText } = req.body;
    if (!bloodGroup || !Number.isFinite(Number(deltaUnits)) || Number(deltaUnits) === 0) {
      return res.status(400).json({ message: "bloodGroup and non-zero deltaUnits are required." });
    }

    const result = await adjustHospitalStock({
      hospitalId: hospital.user_id,
      bloodGroup,
      deltaUnits: Number(deltaUnits),
      thresholdUnits,
      createdByUserId: req.user.id,
      notesText: notesText || "Manual stock adjust",
      allowFloorAtZero: false,
    });

    await logActivity({
      actorUserId: req.user.id,
      action: "stock_adjusted",
      entityType: "stock",
      entityId: null,
      details: { bloodGroup, deltaUnits: result.appliedDelta, unitsAfter: result.unitsAfter },
    });

    return res.status(200).json({ message: "Stock adjusted.", result });
  } catch (error) {
    return next(error);
  }
};

const getStockTrend = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    const days = Number(req.query.days || 30);
    const rows = await getHospitalStockTrend(hospital.user_id, days);
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const exportStockTransactions = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    const rows = await getHospitalStockTransactionsForExport(hospital.user_id, Number(req.query.limit || 1000));
    const header =
      "ID,HospitalID,HospitalName,BloodGroup,Action,UnitsChanged,UnitsBefore,UnitsAfter,Notes,CreatedByUserID,CreatedAtISO";
    const lines = rows.map((r) =>
      [
        r.id,
        r.hospital_id,
        `"${String(r.hospital_name || "").replace(/"/g, '""')}"`,
        r.blood_group,
        r.action_text,
        r.units_changed,
        r.units_before,
        r.units_after,
        `"${String(r.notes_text || "").replace(/"/g, '""')}"`,
        r.created_by_user_id || "",
        new Date(Number(r.created_at_ts) * 1000).toISOString(),
      ].join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=hospital-stock-transactions.csv");
    return res.status(200).send([header, ...lines].join("\n"));
  } catch (error) {
    return next(error);
  }
};

const getDonorHistoryForApproval = async (req, res, next) => {
  try {
    const rows = await getDonorHistory(Number(req.params.donorId));
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const confirmDonation = async (req, res, next) => {
  try {
    const { donorId, requestId, status, donationDate, units } = req.body;
    const [[requestRow]] = await pool.execute("SELECT hospital_id, blood_group FROM blood_requests WHERE id = ? LIMIT 1", [
      requestId,
    ]);
    if (!requestRow) {
      return res.status(404).json({ message: "Request not found." });
    }
    if (Number(requestRow.hospital_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: "You can only confirm donations for your own hospital requests." });
    }

    const donationUnits = Number(units || 1);
    await pool.execute(
      `INSERT INTO donations (donor_id, request_id, donation_date, status, units)
       VALUES (?, ?, ?, ?, ?)`,
      [donorId, requestId, donationDate || new Date(), status || "completed", donationUnits]
    );
    await updateRequestStatus(requestId, "completed");

    await adjustHospitalStock({
      hospitalId: req.user.id,
      bloodGroup: requestRow.blood_group,
      deltaUnits: -donationUnits,
      createdByUserId: req.user.id,
      notesText: `Auto deduction for donation confirmation request #${requestId}`,
      allowFloorAtZero: true,
    });

    await createNotification({
      userId: donorId,
      type: "donation_confirmation",
      title: "Donation confirmed",
      message: `Your donation for request #${requestId} has been confirmed.`,
      meta: { requestId },
    });

    return res.status(201).json({ message: "Donation confirmed." });
  } catch (error) {
    return next(error);
  }
};

const getAppointmentsForHospital = async (req, res, next) => {
  try {
    const rows = await getHospitalAppointments(req.user.id);
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const confirmAppointment = async (req, res, next) => {
  try {
    const hasSlotUpdate = Boolean(req.body.slotAt);
    const requested = String(req.body.status || (hasSlotUpdate ? "rescheduled" : "confirmed")).toLowerCase();
    const mappedStatus = requested === "arrived" ? "confirmed" : requested;
    if (!["booked", "rescheduled", "cancelled", "confirmed", "completed"].includes(mappedStatus)) {
      return res.status(400).json({ message: "Invalid appointment status." });
    }
    const updated = await updateAppointmentByHospital(Number(req.params.appointmentId), req.user.id, {
      slotAt: req.body.slotAt || null,
      status: mappedStatus,
    });
    if (!updated) {
      return res.status(404).json({ message: "Appointment not found." });
    }
    return res.status(200).json({ message: "Appointment updated." });
  } catch (error) {
    return next(error);
  }
};

const postAnnouncement = async (req, res, next) => {
  try {
    const hospital = await getHospitalByUserId(req.user.id);
    const [result] = await pool.execute(
      `INSERT INTO announcements (created_by, title, message, audience, is_active)
       VALUES (?, ?, ?, 'all', 1)`,
      [hospital.user_id, req.body.title, req.body.message]
    );
    return res.status(201).json({ message: "Announcement posted.", id: result.insertId });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};
