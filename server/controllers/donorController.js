const {
  getDonorProfile,
  updateEligibility,
  getNearbyRequests,
  getDonationHistory,
  getDonationSummary,
  updateDonorProfile,
} = require("../models/donorModel");
const { expireOldRequests, getRequestById, updateRequestStatus } = require("../models/requestModel");
const {
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} = require("../models/notificationModel");
const { createAppointment, updateAppointment, getDonorAppointments } = require("../models/appointmentModel");
const { logActivity } = require("../models/activityModel");
const pool = require("../config/db");

const calculateEligibility = (lastDonationDate) => {
  if (!lastDonationDate) {
    return { eligible: true, nextEligibleInDays: 0 };
  }

  const now = new Date();
  const last = new Date(lastDonationDate);
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  const eligible = diffDays >= 90;
  return { eligible, nextEligibleInDays: eligible ? 0 : 90 - diffDays };
};

const getNextEligibleDate = (lastDonationDate) => {
  if (!lastDonationDate) return null;
  const next = new Date(lastDonationDate);
  next.setDate(next.getDate() + 90);
  return next.toISOString().slice(0, 10);
};

const getDonorEngagement = async (donorId) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let yearlyCompleted = 0;
  try {
    const [[row]] = await pool.execute(
      `SELECT COUNT(*) AS count
       FROM donations
       WHERE donor_id = ? AND status = 'completed' AND YEAR(donation_date) = ?`,
      [donorId, year]
    );
    yearlyCompleted = Number(row.count || 0);
  } catch (error) {
    if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
  }

  let leaderboard = [];
  try {
    const [rows] = await pool.execute(
      `SELECT u.name, COUNT(*) AS donations, COALESCE(SUM(d.units), COUNT(*)) AS units
       FROM donations d
       INNER JOIN users u ON u.id = d.donor_id
       WHERE d.status = 'completed'
       GROUP BY d.donor_id, u.name
       ORDER BY donations DESC, units DESC
       LIMIT 5`
    );
    leaderboard = rows.map((r, idx) => ({
      rank: idx + 1,
      name: r.name,
      donations: Number(r.donations || 0),
      units: Number(r.units || 0),
    }));
  } catch (error) {
    if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
  }

  let monthlyTopDonor = "N/A";
  try {
    const [[top]] = await pool.execute(
      `SELECT u.name, COUNT(*) AS donations
       FROM donations d
       INNER JOIN users u ON u.id = d.donor_id
       WHERE d.status = 'completed' AND YEAR(d.donation_date) = ? AND MONTH(d.donation_date) = ?
       GROUP BY d.donor_id, u.name
       ORDER BY donations DESC
       LIMIT 1`,
      [year, month]
    );
    monthlyTopDonor = top?.name || "N/A";
  } catch (error) {
    if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
  }

  const target = 3;
  return {
    yearlyGoalTarget: target,
    yearlyGoalCompleted: yearlyCompleted,
    monthlyTopDonor,
    leaderboard,
  };
};

const getDashboard = async (req, res, next) => {
  try {
    await expireOldRequests();
    const profile = await getDonorProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: "Donor profile not found." });
    }

    const restrictionStatus = String(profile.restriction_status_text || "eligible");
    const eligibility = calculateEligibility(profile.last_donation_date);
    if (restrictionStatus === "temporarily_not_eligible") {
      eligibility.eligible = false;
      if (!Number.isFinite(Number(eligibility.nextEligibleInDays)) || eligibility.nextEligibleInDays <= 0) {
        eligibility.nextEligibleInDays = 30;
      }
    }
    if (restrictionStatus === "permanently_restricted") {
      eligibility.eligible = false;
      eligibility.nextEligibleInDays = 9999;
    }
    await updateEligibility(req.user.id, eligibility.eligible ? 1 : 0);

    const nearbyRequests = eligibility.eligible
      ? await getNearbyRequests(profile, {
          city: req.query.city || "",
          state: req.query.state || "",
          emergencyOnly: req.query.emergencyOnly === "1",
          maxDistanceKm: req.query.maxDistanceKm ? Number(req.query.maxDistanceKm) : null,
          bloodGroup: req.query.bloodGroup || "",
          sortByUrgency: req.query.sortByUrgency === "1",
        })
      : [];
    const donationHistory = await getDonationHistory(req.user.id, {
      search: req.query.search || "",
      dateFrom: req.query.dateFrom || "",
      dateTo: req.query.dateTo || "",
    });
    const summary = await getDonationSummary(req.user.id);
    const engagement = await getDonorEngagement(req.user.id);
    let unreadNotificationCount = 0;
    try {
      unreadNotificationCount = await getUnreadNotificationCount(req.user.id);
    } catch (error) {
      if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
    }

    return res.status(200).json({
      profile: {
        ...profile,
        eligible_status: eligibility.eligible ? 1 : 0,
        eligibility_badge:
          restrictionStatus === "permanently_restricted"
            ? "Permanently Restricted"
            : restrictionStatus === "temporarily_not_eligible"
            ? "Temporarily Not Eligible"
            : eligibility.eligible
            ? "Eligible"
            : "Temporarily Not Eligible",
      },
      nextEligibleInDays: eligibility.nextEligibleInDays,
      nextEligibleDate: getNextEligibleDate(profile.last_donation_date),
      nearbyRequests,
      donationHistory,
      achievements: {
        badges: [
          summary.total_donations >= 1 ? "First Donation" : "",
          summary.total_donations >= 5 ? "5 Donations" : "",
          summary.total_donations >= 10 ? "10 Donations" : "",
          summary.total_donations >= 3 ? "Camp Volunteer" : "",
        ].filter(Boolean),
      },
      engagement,
      stats: {
        totalDonations: summary.total_donations,
        totalBloodUnits: summary.total_units,
        streak: summary.streak,
        activeRequestsNearby: nearbyRequests.length,
      },
      unreadNotificationCount,
    });
  } catch (error) {
    return next(error);
  }
};

const respondToRequest = async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const { action } = req.body;
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Invalid action." });
    }

    const requestData = await getRequestById(requestId);
    if (!requestData) {
      return res.status(404).json({ message: "Request not found." });
    }

    await pool.execute(
      `INSERT INTO request_responses (request_id, donor_id, status)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), responded_at = CURRENT_TIMESTAMP`,
      [requestId, req.user.id, action === "accept" ? "accepted" : "declined"]
    );
    if (action === "accept") {
      await updateRequestStatus(requestId, "matched");
    }

    await createNotification({
      userId: requestData.hospital_id,
      type: "request_response",
      title: "Donor response received",
      message: `A donor has ${action}ed your blood request #${requestId}.`,
      meta: { requestId, donorId: req.user.id, action },
    });

    await logActivity({
      actorUserId: req.user.id,
      action: "donor_request_response",
      entityType: "blood_request",
      entityId: requestId,
      details: { action },
    });

    return res.status(200).json({ message: `Request ${action}ed.` });
  } catch (error) {
    return next(error);
  }
};

const bookAppointmentSlot = async (req, res, next) => {
  try {
    const { requestId, slotAt, notes } = req.body;
    const requestData = await getRequestById(requestId);
    if (!requestData) {
      return res.status(404).json({ message: "Request not found." });
    }

    const appointmentId = await createAppointment({
      requestId,
      donorId: req.user.id,
      hospitalId: requestData.hospital_id,
      slotAt,
      notes,
    });

    await createNotification({
      userId: requestData.hospital_id,
      type: "appointment",
      title: "New appointment booked",
      message: `A donor booked appointment for request #${requestId}.`,
      meta: { appointmentId, requestId, donorId: req.user.id, slotAt },
    });

    return res.status(201).json({ message: "Appointment booked.", appointmentId });
  } catch (error) {
    return next(error);
  }
};

const rescheduleAppointment = async (req, res, next) => {
  try {
    const updated = await updateAppointment(Number(req.params.appointmentId), req.user.id, {
      slotAt: req.body.slotAt,
      status: "rescheduled",
    });
    if (!updated) {
      return res.status(404).json({ message: "Appointment not found." });
    }
    return res.status(200).json({ message: "Appointment rescheduled." });
  } catch (error) {
    return next(error);
  }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const updated = await updateAppointment(Number(req.params.appointmentId), req.user.id, {
      status: "cancelled",
    });
    if (!updated) {
      return res.status(404).json({ message: "Appointment not found." });
    }
    return res.status(200).json({ message: "Appointment cancelled." });
  } catch (error) {
    return next(error);
  }
};

const getAppointments = async (req, res, next) => {
  try {
    const rows = await getDonorAppointments(req.user.id);
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const submitQuestionnaire = async (req, res, next) => {
  try {
    await pool.execute(
      `INSERT INTO pre_donation_questionnaires (donor_id, appointment_id, answers, risk_level)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, req.body.appointmentId || null, JSON.stringify(req.body.answers || {}), req.body.riskLevel || "low"]
    );
    return res.status(201).json({ message: "Questionnaire submitted." });
  } catch (error) {
    return next(error);
  }
};

const submitDonationFeedback = async (req, res, next) => {
  try {
    await pool.execute(
      `INSERT INTO donor_feedback (donor_id, hospital_id, donation_id, rating, feedback)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, req.body.hospitalId, req.body.donationId || null, req.body.rating, req.body.feedback || null]
    );
    return res.status(201).json({ message: "Feedback submitted." });
  } catch (error) {
    return next(error);
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await getNotifications(req.user.id);
    const unreadCount = await getUnreadNotificationCount(req.user.id);
    return res.status(200).json({ unreadCount, notifications });
  } catch (error) {
    return next(error);
  }
};

const markMyNotificationRead = async (req, res, next) => {
  try {
    const updated = await markNotificationRead(Number(req.params.notificationId), req.user.id);
    if (!updated) {
      return res.status(404).json({ message: "Notification not found." });
    }
    return res.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    return next(error);
  }
};

const markAllMyNotificationsRead = async (req, res, next) => {
  try {
    const updated = await markAllNotificationsRead(req.user.id);
    return res.status(200).json({ message: "All notifications marked as read.", updated });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    await updateDonorProfile(req.user.id, req.body);
    return res.status(200).json({ message: "Profile updated." });
  } catch (error) {
    return next(error);
  }
};

const exportDonationHistory = async (req, res, next) => {
  try {
    const rows = await getDonationHistory(req.user.id, {
      search: req.query.search || "",
      dateFrom: req.query.dateFrom || "",
      dateTo: req.query.dateTo || "",
    });
    const header = "DonationID,BloodGroup,City,Hospital,Date,Status";
    const lines = rows.map((r) => {
      const dateValue =
        typeof r.donation_date === "string"
          ? r.donation_date.slice(0, 10)
          : r.donation_date?.toISOString?.().slice(0, 10) || "";
      return [r.id, r.blood_group, r.city, r.hospital_name || "", dateValue, r.status].join(",");
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=donation-history.csv");
    return res.status(200).send([header, ...lines].join("\n"));
  } catch (error) {
    return next(error);
  }
};

const getDonationCertificate = async (req, res, next) => {
  try {
    const donationId = Number(req.params.donationId);
    const [rows] = await pool.execute(
      `SELECT d.id, d.donation_date, u.name
       FROM donations d
       INNER JOIN users u ON u.id = d.donor_id
       WHERE d.id = ? AND d.donor_id = ?`,
      [donationId, req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: "Donation not found." });
    }
    const certificate = `Blood Donation Certificate\nDonor: ${rows[0].name}\nDonation ID: ${rows[0].id}\nDate: ${
      rows[0].donation_date?.toISOString?.().slice(0, 10) || ""
    }\nThank you for saving lives.`;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename=certificate-${donationId}.txt`);
    return res.status(200).send(certificate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};
