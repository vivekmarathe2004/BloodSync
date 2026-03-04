const pool = require("../config/db");
const { getRecipientGroupsForDonor } = require("../utils/compatibility");

const createDonorProfile = async ({ userId, bloodGroup, age, gender, lastDonationDate }) => {
  await pool.execute(
    `INSERT INTO donors (user_id, blood_group, age, gender, last_donation_date, eligible_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, bloodGroup, age, gender, lastDonationDate || null, 1]
  );
};

const getDonorProfile = async (userId) => {
  const queries = [
    `SELECT d.*, u.name, u.email, u.phone, u.city, u.state, u.latitude, u.longitude, u.profile_photo_url
     FROM donors d
     INNER JOIN users u ON u.id = d.user_id
     WHERE d.user_id = ?
     LIMIT 1`,
    `SELECT d.*, u.name, u.email, u.phone, u.city, NULL AS state, NULL AS latitude, NULL AS longitude, NULL AS profile_photo_url
     FROM donors d
     INNER JOIN users u ON u.id = d.user_id
     WHERE d.user_id = ?
     LIMIT 1`,
    `SELECT d.*, u.name, u.city
     FROM donors d
     INNER JOIN users u ON u.id = d.user_id
     WHERE d.user_id = ?
     LIMIT 1`,
  ];

  for (const sql of queries) {
    try {
      const [rows] = await pool.execute(sql, [userId]);
      if (!rows[0]) return null;
      return {
        restriction_status_text: "eligible",
        preferred_location_text: rows[0].city || "",
        max_travel_km: 25,
        weight_kg: null,
        ...rows[0],
      };
    } catch (error) {
      if (error && error.code === "ER_BAD_FIELD_ERROR") continue;
      throw error;
    }
  }

  return null;
};

const updateDonorProfile = async (userId, payload) => {
  const { healthInfo, profilePhotoUrl, city, state, latitude, longitude, phone, weightKg, preferredLocation, maxTravelKm } = payload;

  try {
    await pool.execute(
      `UPDATE donors
       SET health_info = COALESCE(?, health_info),
           weight_kg = COALESCE(?, weight_kg),
           preferred_location_text = COALESCE(?, preferred_location_text),
           max_travel_km = COALESCE(?, max_travel_km)
       WHERE user_id = ?`,
      [
        healthInfo || null,
        weightKg != null && weightKg !== "" ? Number(weightKg) : null,
        preferredLocation || null,
        maxTravelKm != null && maxTravelKm !== "" ? Number(maxTravelKm) : null,
        userId,
      ]
    );
  } catch (error) {
    if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
    await pool.execute("UPDATE donors SET health_info = COALESCE(?, health_info) WHERE user_id = ?", [healthInfo || null, userId]);
  }

  const userUpdateQueries = [
    {
      sql: `UPDATE users
            SET profile_photo_url = COALESCE(?, profile_photo_url),
                city = COALESCE(?, city),
                state = COALESCE(?, state),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                phone = COALESCE(?, phone)
            WHERE id = ?`,
      params: [
        profilePhotoUrl || null,
        city || null,
        state || null,
        latitude != null && latitude !== "" ? Number(latitude) : null,
        longitude != null && longitude !== "" ? Number(longitude) : null,
        phone || null,
        userId,
      ],
    },
    {
      sql: `UPDATE users
            SET city = COALESCE(?, city), phone = COALESCE(?, phone)
            WHERE id = ?`,
      params: [city || null, phone || null, userId],
    },
  ];

  for (const query of userUpdateQueries) {
    try {
      await pool.execute(query.sql, query.params);
      return;
    } catch (error) {
      if (error && error.code === "ER_BAD_FIELD_ERROR") continue;
      throw error;
    }
  }
};

const updateEligibility = async (userId, eligibleStatus) => {
  await pool.execute("UPDATE donors SET eligible_status = ? WHERE user_id = ?", [eligibleStatus, userId]);
};

const buildFallbackNearbyQuery = async (city) => {
  const [rows] = await pool.execute(
    `SELECT br.id, br.blood_group, br.units, br.urgency, br.city, br.status, br.created_at
     FROM blood_requests br
     WHERE br.city = ? AND br.status IN ('active', 'pending', 'matched')
     ORDER BY br.created_at DESC
     LIMIT 20`,
    [city || ""]
  );
  return rows;
};

const getNearbyRequests = async (profile, filters = {}) => {
  if (!profile || !profile.blood_group) return [];

  const compatibleRecipientGroups = getRecipientGroupsForDonor(profile.blood_group);
  const params = [...compatibleRecipientGroups];
  const where = [
    `br.blood_group IN (${compatibleRecipientGroups.map(() => "?").join(",")})`,
    "br.status IN ('pending', 'matched')",
  ];

  if (filters.bloodGroup) {
    where.push("br.blood_group = ?");
    params.push(filters.bloodGroup);
  }

  if (filters.city) {
    where.push("br.city = ?");
    params.push(filters.city);
  } else if (profile.city) {
    where.push("br.city = ?");
    params.push(profile.city);
  }

  if (filters.state) {
    where.push("u.state = ?");
    params.push(filters.state);
  }

  if (filters.emergencyOnly) {
    where.push("br.request_type = 'emergency'");
  }

  const effectiveMaxDistanceKm =
    Number.isFinite(Number(filters.maxDistanceKm)) && Number(filters.maxDistanceKm) > 0
      ? Number(filters.maxDistanceKm)
      : Number(profile.max_travel_km || 0);

  const hasCoords =
    Number.isFinite(Number(profile.latitude)) &&
    Number.isFinite(Number(profile.longitude)) &&
    Number.isFinite(Number(effectiveMaxDistanceKm)) &&
    Number(effectiveMaxDistanceKm) > 0;

  let distanceSelect = "NULL AS distance_km";
  let having = "";
  if (hasCoords) {
    distanceSelect = `(6371 * ACOS(
      COS(RADIANS(?)) * COS(RADIANS(COALESCE(br.latitude, u.latitude))) *
      COS(RADIANS(COALESCE(br.longitude, u.longitude)) - RADIANS(?)) +
      SIN(RADIANS(?)) * SIN(RADIANS(COALESCE(br.latitude, u.latitude)))
    )) AS distance_km`;
    params.unshift(Number(profile.latitude), Number(profile.longitude), Number(profile.latitude));
    having = "HAVING distance_km <= ?";
    params.push(Number(effectiveMaxDistanceKm));
  }

  const urgencySort = filters.sortByUrgency
    ? "CASE br.urgency WHEN 'critical' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END ASC,"
    : "";

  try {
    const [rows] = await pool.execute(
      `SELECT
        br.id, br.blood_group, br.units, br.urgency, br.city, br.status, br.request_type, br.expires_at, br.created_at,
        h.hospital_name, h.address, ${distanceSelect}
       FROM blood_requests br
       INNER JOIN hospitals h ON h.user_id = br.hospital_id
       INNER JOIN users u ON u.id = h.user_id
       WHERE ${where.join(" AND ")}
       ${having}
       ORDER BY ${urgencySort} ${hasCoords ? "distance_km ASC," : ""} br.created_at DESC
       LIMIT 20`,
      params
    );

    return rows.map((row) => ({
      ...row,
      high_match_badge:
        String(row.blood_group || "").toUpperCase() === String(profile.blood_group || "").toUpperCase() &&
        Number(row.distance_km || 9999) <= 10
          ? 1
          : 0,
      emergency_highlight: row.urgency === "critical" || row.request_type === "emergency" ? 1 : 0,
    }));
  } catch (error) {
    if (error && (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE")) {
      return buildFallbackNearbyQuery(filters.city || profile.city || "");
    }
    throw error;
  }
};

const getDonationHistory = async (donorId, { search = "", dateFrom = "", dateTo = "" } = {}) => {
  const pattern = `%${search}%`;
  const filters = [];
  const params = [donorId, pattern, pattern, pattern];

  if (dateFrom) {
    filters.push("d.donation_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("d.donation_date <= ?");
    params.push(dateTo);
  }

  const whereSql = filters.length ? ` AND ${filters.join(" AND ")}` : "";

  try {
    const [rows] = await pool.execute(
      `SELECT d.id, d.donation_date, d.status, br.blood_group, br.city, h.hospital_name
       FROM donations d
       INNER JOIN blood_requests br ON br.id = d.request_id
       LEFT JOIN hospitals h ON h.user_id = br.hospital_id
       WHERE d.donor_id = ? AND (br.city LIKE ? OR br.blood_group LIKE ? OR COALESCE(h.hospital_name, '') LIKE ?)
       ${whereSql}
       UNION ALL
       SELECT (1000000 + cd.id) AS id, cd.donation_date_text AS donation_date, cd.status_text AS status, 'CAMP' AS blood_group, c.location_text AS city, 'CAMP' AS hospital_name
       FROM camp_donations cd
       INNER JOIN camps c ON c.id = cd.camp_id
       WHERE cd.donor_id = ? AND (c.location_text LIKE ? OR 'CAMP' LIKE ? OR 'CAMP' LIKE ?)
       ORDER BY donation_date DESC`,
      [...params, donorId, pattern, pattern, pattern]
    );
    return rows;
  } catch (error) {
    if (error && error.code === "ER_NO_SUCH_TABLE") {
      const [rows] = await pool.execute(
        `SELECT d.id, d.donation_date, d.status, br.blood_group, br.city, h.hospital_name
         FROM donations d
         INNER JOIN blood_requests br ON br.id = d.request_id
         LEFT JOIN hospitals h ON h.user_id = br.hospital_id
         WHERE d.donor_id = ? AND (br.city LIKE ? OR br.blood_group LIKE ? OR COALESCE(h.hospital_name, '') LIKE ?)
         ${whereSql}
         ORDER BY d.donation_date DESC`,
        params
      );
      return rows;
    }
    throw error;
  }
};

const getDonationSummary = async (donorId) => {
  let totals;
  try {
    [[totals]] = await pool.execute(
      `SELECT COUNT(*) AS total_donations, COALESCE(SUM(d.units), 0) AS total_units
       FROM donations d
       WHERE d.donor_id = ? AND d.status = 'completed'`,
      [donorId]
    );
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      [[totals]] = await pool.execute(
        `SELECT COUNT(*) AS total_donations, COUNT(*) AS total_units
         FROM donations d
         WHERE d.donor_id = ? AND d.status = 'completed'`,
        [donorId]
      );
    } else {
      throw error;
    }
  }

  try {
    const [[campTotals]] = await pool.execute(
      `SELECT COUNT(*) AS camp_donations, COALESCE(SUM(units), 0) AS camp_units
       FROM camp_donations
       WHERE donor_id = ?`,
      [donorId]
    );
    totals.total_donations += Number(campTotals.camp_donations || 0);
    totals.total_units += Number(campTotals.camp_units || 0);
  } catch (error) {
    if (!(error && error.code === "ER_NO_SUCH_TABLE")) throw error;
  }

  const [dates] = await pool.execute(
    `SELECT donation_date
     FROM donations
     WHERE donor_id = ? AND status = 'completed'
     ORDER BY donation_date DESC`,
    [donorId]
  );

  let streak = 0;
  let prev = null;
  dates.forEach((row) => {
    const current = new Date(row.donation_date);
    if (!prev) {
      streak = 1;
      prev = current;
      return;
    }
    const diff = Math.floor((prev - current) / (1000 * 60 * 60 * 24));
    if (diff <= 120) {
      streak += 1;
      prev = current;
    }
  });

  return { ...totals, streak };
};

const setDonorRestrictionStatus = async (userId, restrictionStatus) => {
  const normalized = String(restrictionStatus || "").trim();
  if (!["eligible", "temporarily_not_eligible", "permanently_restricted"].includes(normalized)) {
    throw new Error("Invalid restriction status.");
  }
  const eligible = normalized === "eligible" ? 1 : 0;

  try {
    const [result] = await pool.execute(
      `UPDATE donors
       SET restriction_status_text = ?, eligible_status = ?
       WHERE user_id = ?`,
      [normalized, eligible, userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      const [result] = await pool.execute("UPDATE donors SET eligible_status = ? WHERE user_id = ?", [eligible, userId]);
      return result.affectedRows > 0;
    }
    throw error;
  }
};

module.exports = {
  createDonorProfile,
  getDonorProfile,
  updateDonorProfile,
  updateEligibility,
  getNearbyRequests,
  getDonationHistory,
  getDonationSummary,
  setDonorRestrictionStatus,
};
