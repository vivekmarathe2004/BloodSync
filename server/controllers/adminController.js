const bcrypt = require("bcryptjs");
const {
  getUsers,
  deleteUserById,
  setUserActiveStatus,
  createUser,
  findUserByEmail,
  getUserByIdForAdmin,
  updateUserRole,
} = require("../models/userModel");
const { createDonorProfile, setDonorRestrictionStatus } = require("../models/donorModel");
const { createHospitalProfile } = require("../models/hospitalModel");
const {
  getGlobalStats,
  getBloodGroupDistribution,
  getCityDistribution,
  getDemandHeatmap,
  getLiveAvailability,
} = require("../models/donationModel");
const { getActivityTimeline, logActivity } = require("../models/activityModel");
const { createBulkNotifications } = require("../models/notificationModel");
const { expireOldRequests } = require("../models/requestModel");
const { getSystemStockTrend, getSystemStockTransactionsForExport } = require("../models/stockModel");
const { CITY_OPTIONS } = require("../constants/options");
const pool = require("../config/db");

const assertAdminCanManageTarget = (actor, target) => {
  if (!target) return "User not found.";
  if (Number(actor.id) === Number(target.id)) return "You cannot perform this action on yourself.";
  if (target.is_super_admin && !actor.isSuperAdmin) return "Only super admin can manage this account.";
  return "";
};

const getActorAdminInfo = async (actorId) => {
  const actor = await getUserByIdForAdmin(actorId);
  return {
    ...actor,
    isSuperAdmin: Number(actor?.is_super_admin || 0) === 1,
  };
};

const getDashboard = async (req, res, next) => {
  try {
    const [stats, bloodGroupChart, cityChart, users, heatmap, liveAvailability] = await Promise.all([
      getGlobalStats(req.query.dateFrom || "", req.query.dateTo || ""),
      getBloodGroupDistribution(),
      getCityDistribution(),
      getUsers(req.query.search || "", req.query.role || "", req.query.dateFrom || "", req.query.dateTo || ""),
      getDemandHeatmap(),
      getLiveAvailability(),
    ]);

    return res.status(200).json({
      stats,
      charts: {
        bloodGroup: bloodGroupChart,
        city: cityChart,
      },
      users,
      heatmap,
      liveAvailability,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const actor = await getActorAdminInfo(req.user.id);
    const target = await getUserByIdForAdmin(req.params.id);
    const restriction = assertAdminCanManageTarget(actor, target);
    if (restriction) {
      return res.status(403).json({ message: restriction });
    }

    const deleted = await deleteUserById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found." });
    }
    await logActivity({
      actorUserId: req.user.id,
      action: "user_deleted",
      entityType: "user",
      entityId: Number(req.params.id),
    });
    return res.status(200).json({ message: "User deleted." });
  } catch (error) {
    return next(error);
  }
};

const setUserBanStatus = async (req, res, next) => {
  try {
    const actor = await getActorAdminInfo(req.user.id);
    const target = await getUserByIdForAdmin(req.params.id);
    const restriction = assertAdminCanManageTarget(actor, target);
    if (restriction) {
      return res.status(403).json({ message: restriction });
    }

    const isActive = req.body.isActive === true || req.body.isActive === 1;
    const updated = await setUserActiveStatus(req.params.id, isActive);
    if (!updated) {
      return res.status(404).json({ message: "User not found." });
    }
    await logActivity({
      actorUserId: req.user.id,
      action: isActive ? "user_unbanned" : "user_banned",
      entityType: "user",
      entityId: Number(req.params.id),
    });
    return res.status(200).json({ message: isActive ? "User unbanned." : "User banned." });
  } catch (error) {
    return next(error);
  }
};

const setUserRestriction = async (req, res, next) => {
  try {
    const actor = await getActorAdminInfo(req.user.id);
    const target = await getUserByIdForAdmin(req.params.id);
    const restriction = assertAdminCanManageTarget(actor, target);
    if (restriction) {
      return res.status(403).json({ message: restriction });
    }
    if (target.role !== "donor") {
      return res.status(400).json({ message: "Restriction status can only be updated for donor users." });
    }

    const restrictionStatus = String(req.body.restrictionStatus || "").trim();
    if (!["eligible", "temporarily_not_eligible", "permanently_restricted"].includes(restrictionStatus)) {
      return res.status(400).json({ message: "Invalid restriction status." });
    }

    const updated = await setDonorRestrictionStatus(Number(req.params.id), restrictionStatus);
    if (!updated) {
      return res.status(404).json({ message: "Donor profile not found." });
    }

    await logActivity({
      actorUserId: req.user.id,
      action: "donor_restriction_updated",
      entityType: "user",
      entityId: Number(req.params.id),
      details: { restrictionStatus },
    });

    return res.status(200).json({ message: "Donor restriction updated." });
  } catch (error) {
    return next(error);
  }
};

const addAdmin = async (req, res, next) => {
  try {
    const actor = await getActorAdminInfo(req.user.id);
    const { name, email, password, phone, city, state, role } = req.body;
    const isSuperAdmin = role === "super_admin";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (city && !CITY_OPTIONS.includes(city)) {
      return res.status(400).json({ message: `City must be one of: ${CITY_OPTIONS.join(", ")}` });
    }
    if (isSuperAdmin && !actor.isSuperAdmin) {
      return res.status(403).json({ message: "Only super admin can create super admin." });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await createUser({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      phone,
      city,
      state,
      createdBy: req.user.id,
      isSuperAdmin,
    });

    await logActivity({
      actorUserId: req.user.id,
      action: "admin_created",
      entityType: "user",
      entityId: userId,
      details: { email, role: isSuperAdmin ? "super_admin" : "admin" },
    });

    return res.status(201).json({ message: "Admin created.", id: userId });
  } catch (error) {
    return next(error);
  }
};

const changeUserRole = async (req, res, next) => {
  try {
    const actor = await getActorAdminInfo(req.user.id);
    const target = await getUserByIdForAdmin(req.params.id);
    const restriction = assertAdminCanManageTarget(actor, target);
    if (restriction) {
      return res.status(403).json({ message: restriction });
    }

    const nextRole = req.body.role;
    if (!["donor", "hospital"].includes(nextRole)) {
      return res.status(400).json({ message: "Role must be donor or hospital." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ message: "Use admin controls to manage admin users." });
    }
    if (target.role === nextRole) {
      return res.status(200).json({ message: "Role unchanged." });
    }

    await pool.execute("DELETE FROM donors WHERE user_id = ?", [target.id]);
    await pool.execute("DELETE FROM hospitals WHERE user_id = ?", [target.id]);

    if (nextRole === "donor") {
      const { bloodGroup, age, gender } = req.body;
      if (!bloodGroup || !age || !gender) {
        return res.status(400).json({ message: "bloodGroup, age and gender are required for donor role." });
      }
      await createDonorProfile({
        userId: target.id,
        bloodGroup,
        age: Number(age),
        gender,
      });
    }

    if (nextRole === "hospital") {
      const { hospitalName, address } = req.body;
      await createHospitalProfile({
        userId: target.id,
        hospitalName: hospitalName || `${target.name} Hospital`,
        address: address || `${target.city || "Unknown city"} - Address pending`,
      });
    }

    await updateUserRole(target.id, nextRole);
    await logActivity({
      actorUserId: req.user.id,
      action: "user_role_changed",
      entityType: "user",
      entityId: target.id,
      details: { fromRole: target.role, toRole: nextRole },
    });

    return res.status(200).json({ message: "User role updated." });
  } catch (error) {
    return next(error);
  }
};

const bulkUserAction = async (req, res, next) => {
  try {
    const actor = await getActorAdminInfo(req.user.id);
    const action = req.body.action;
    const userIds = Array.isArray(req.body.userIds) ? req.body.userIds.map((id) => Number(id)).filter(Boolean) : [];

    if (!["suspend", "activate", "delete"].includes(action)) {
      return res.status(400).json({ message: "Invalid bulk action." });
    }
    if (!userIds.length) {
      return res.status(400).json({ message: "No users selected." });
    }

    let affected = 0;
    for (const userId of userIds) {
      const target = await getUserByIdForAdmin(userId);
      const restriction = assertAdminCanManageTarget(actor, target);
      if (restriction) {
        continue;
      }

      if (action === "suspend") {
        await setUserActiveStatus(userId, false);
      } else if (action === "activate") {
        await setUserActiveStatus(userId, true);
      } else if (action === "delete") {
        await deleteUserById(userId);
      }
      affected += 1;
    }

    await logActivity({
      actorUserId: req.user.id,
      action: `users_bulk_${action}`,
      entityType: "user",
      entityId: null,
      details: { requested: userIds.length, affected },
    });

    return res.status(200).json({ message: `Bulk action completed. Affected users: ${affected}.` });
  } catch (error) {
    return next(error);
  }
};

const getAllRequests = async (req, res, next) => {
  try {
    await expireOldRequests();
    const [rows] = await pool.execute(`
      SELECT 
        br.id,
        br.blood_group,
        br.units,
        br.urgency,
        br.city,
        br.status,
        br.created_at,
        h.hospital_name,
        h.address
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.user_id
      ORDER BY br.created_at DESC
    `);
    
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const getDonationHistory = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        d.id,
        d.donation_date,
        d.status,
        u.name as donor_name,
        h.hospital_name,
        br.blood_group
      FROM donations d
      JOIN donors donor ON d.donor_id = donor.user_id
      JOIN users u ON donor.user_id = u.id
      JOIN blood_requests br ON d.request_id = br.id
      JOIN hospitals h ON br.hospital_id = h.user_id
      ORDER BY d.donation_date DESC
    `);
    
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const getSystemActivity = async (req, res, next) => {
  try {
    const timeline = await getActivityTimeline(Number(req.query.limit || 100));
    return res.status(200).json(timeline);
  } catch (error) {
    return next(error);
  }
};

const exportSystemReport = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT br.id, br.city, br.blood_group, br.units, br.urgency, br.status, br.created_at, h.hospital_name
       FROM blood_requests br
       INNER JOIN hospitals h ON h.user_id = br.hospital_id
       ORDER BY br.created_at DESC`
    );
    const header = "RequestID,Hospital,City,BloodGroup,Units,Urgency,Status,CreatedAt";
    const lines = rows.map((r) =>
      [r.id, r.hospital_name, r.city, r.blood_group, r.units, r.urgency, r.status, r.created_at.toISOString()].join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=system-report.csv");
    return res.status(200).send([header, ...lines].join("\n"));
  } catch (error) {
    return next(error);
  }
};

const createAnnouncement = async (req, res, next) => {
  try {
    const { title, message, audience } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO announcements (created_by, title, message, audience, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [req.user.id, title, message, audience || "all"]
    );

    const [users] = await pool.execute(
      `SELECT id
       FROM users
       WHERE is_active = 1
         AND (? = 'all' OR role = ?)`,
      [audience || "all", audience || "all"]
    );

    await createBulkNotifications({
      userIds: users.map((u) => u.id),
      type: "announcement",
      title,
      message,
      meta: { announcementId: result.insertId },
    });

    return res.status(201).json({ message: "Announcement created.", id: result.insertId });
  } catch (error) {
    return next(error);
  }
};

const getStockTrend = async (req, res, next) => {
  try {
    const days = Number(req.query.days || 30);
    const rows = await getSystemStockTrend(days);
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
};

const exportStockTransactions = async (req, res, next) => {
  try {
    const rows = await getSystemStockTransactionsForExport(Number(req.query.limit || 5000));
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
    res.setHeader("Content-Disposition", "attachment; filename=system-stock-transactions.csv");
    return res.status(200).send([header, ...lines].join("\n"));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  deleteUser,
  setUserBanStatus,
  setUserRestriction,
  addAdmin,
  changeUserRole,
  bulkUserAction,
  getAllRequests,
  getDonationHistory,
  getSystemActivity,
  exportSystemReport,
  createAnnouncement,
  getStockTrend,
  exportStockTransactions,
};
