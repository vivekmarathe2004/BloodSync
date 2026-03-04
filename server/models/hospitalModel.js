const pool = require("../config/db");
const { getCompatibleDonorGroupsForRecipient } = require("../utils/compatibility");

const createHospitalProfile = async ({ userId, hospitalName, address }) => {
  await pool.execute("INSERT INTO hospitals (user_id, hospital_name, address) VALUES (?, ?, ?)", [
    userId,
    hospitalName,
    address,
  ]);
};

const getHospitalByUserId = async (userId) => {
  try {
    const [rows] = await pool.execute(
      `SELECT h.*, u.name, u.email, u.phone, u.city, u.state, u.latitude, u.longitude
       FROM hospitals h
       INNER JOIN users u ON u.id = h.user_id
       WHERE h.user_id = ?
       LIMIT 1`,
      [userId]
    );
    return rows[0];
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      const [rows] = await pool.execute(
        `SELECT h.*, u.city
         FROM hospitals h
         INNER JOIN users u ON u.id = h.user_id
         WHERE h.user_id = ?
         LIMIT 1`,
        [userId]
      );
      return rows[0];
    }
    throw error;
  }
};

const updateHospitalProfile = async (userId, payload) => {
  const {
    hospitalName,
    address,
    city,
    state,
    latitude,
    longitude,
    contactPhone,
    contactEmail,
    logoUrl,
    operatingHours,
    bloodBankLicenseNumber,
  } = payload;

  await pool.execute(
    `UPDATE hospitals
     SET hospital_name = COALESCE(?, hospital_name),
         address = COALESCE(?, address),
         contact_phone = COALESCE(?, contact_phone),
         contact_email = COALESCE(?, contact_email),
         logo_url = COALESCE(?, logo_url),
         operating_hours_text = COALESCE(?, operating_hours_text),
         blood_bank_license_number = COALESCE(?, blood_bank_license_number)
     WHERE user_id = ?`,
    [
      hospitalName || null,
      address || null,
      contactPhone || null,
      contactEmail || null,
      logoUrl || null,
      operatingHours || null,
      bloodBankLicenseNumber || null,
      userId,
    ]
  );

  try {
    await pool.execute(
      `UPDATE users
       SET city = COALESCE(?, city),
           state = COALESCE(?, state),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude),
           phone = COALESCE(?, phone)
       WHERE id = ?`,
      [
        city || null,
        state || null,
        latitude != null && latitude !== "" ? Number(latitude) : null,
        longitude != null && longitude !== "" ? Number(longitude) : null,
        contactPhone || null,
        userId,
      ]
    );
  } catch (error) {
    if (!(error && error.code === "ER_BAD_FIELD_ERROR")) throw error;
    await pool.execute("UPDATE users SET city = COALESCE(?, city), phone = COALESCE(?, phone) WHERE id = ?", [
      city || null,
      contactPhone || null,
      userId,
    ]);
  }
};

const getHospitalRequests = async (hospitalId) => {
  const [rows] = await pool.execute(
    `SELECT id, blood_group, units, urgency, city, status, created_at
     FROM blood_requests
     WHERE hospital_id = ?
     ORDER BY created_at DESC`,
    [hospitalId]
  );
  return rows;
};

const getMatchedDonors = async (city, bloodGroup, latitude = null, longitude = null, maxDistanceKm = null) => {
  const donorGroups = getCompatibleDonorGroupsForRecipient(bloodGroup);
  const params = [...donorGroups, city];
  const coordFilterEnabled =
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Number.isFinite(Number(maxDistanceKm));

  let distanceSelect = "NULL AS distance_km";
  if (coordFilterEnabled) {
    distanceSelect = `(6371 * ACOS(
      COS(RADIANS(?)) * COS(RADIANS(u.latitude)) *
      COS(RADIANS(u.longitude) - RADIANS(?)) +
      SIN(RADIANS(?)) * SIN(RADIANS(u.latitude))
    )) AS distance_km`;
    params.unshift(Number(latitude), Number(longitude), Number(latitude));
  }

  let having = "";
  if (coordFilterEnabled) {
    having = "HAVING distance_km <= ?";
    params.push(Number(maxDistanceKm));
  }

  try {
    const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.phone, u.city, u.state, d.blood_group, d.eligible_status, d.last_donation_date, ${distanceSelect}
     FROM donors d
     INNER JOIN users u ON u.id = d.user_id
     WHERE d.blood_group IN (${donorGroups.map(() => "?").join(",")})
       AND u.city = ?
       AND d.eligible_status = 1
     ${having}
     ORDER BY ${coordFilterEnabled ? "distance_km ASC," : ""} d.last_donation_date ASC`,
    params
  );
    return rows;
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      const [rows] = await pool.execute(
        `SELECT u.id, u.name, u.phone, u.city, d.blood_group, d.eligible_status, d.last_donation_date, NULL AS distance_km
         FROM donors d
         INNER JOIN users u ON u.id = d.user_id
         WHERE d.blood_group IN (${donorGroups.map(() => "?").join(",")})
           AND u.city = ?
           AND d.eligible_status = 1
         ORDER BY d.last_donation_date ASC`,
        [...donorGroups, city]
      );
      return rows;
    }
    throw error;
  }
};

const getDonorHistory = async (donorId) => {
  const [rows] = await pool.execute(
    `SELECT d.id, d.donation_date, d.status, br.blood_group, br.city, h.hospital_name
     FROM donations d
     INNER JOIN blood_requests br ON br.id = d.request_id
     INNER JOIN hospitals h ON h.user_id = br.hospital_id
     WHERE d.donor_id = ?
     ORDER BY d.donation_date DESC`,
    [donorId]
  );
  return rows;
};

module.exports = {
  createHospitalProfile,
  getHospitalByUserId,
  updateHospitalProfile,
  getHospitalRequests,
  getMatchedDonors,
  getDonorHistory,
};
