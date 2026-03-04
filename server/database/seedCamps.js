require("dotenv").config();
const pool = require("../config/db");

const nowTs = () => Math.floor(Date.now() / 1000);

const getUserIds = async () => {
  const [[admin]] = await pool.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  const [[hospital]] = await pool.execute("SELECT id FROM users WHERE role = 'hospital' ORDER BY id ASC LIMIT 1");
  const [donors] = await pool.execute("SELECT id FROM users WHERE role = 'donor' ORDER BY id ASC LIMIT 10");
  return {
    adminId: admin?.id || null,
    hospitalId: hospital?.id || null,
    donorIds: donors.map((d) => Number(d.id)),
  };
};

const upsertCamp = async (camp, ts) => {
  const [existingRows] = await pool.execute(
    "SELECT id FROM camps WHERE camp_name = ? AND camp_date_text = ? LIMIT 1",
    [camp.campName, camp.startDate]
  );
  if (existingRows.length) {
    const id = Number(existingRows[0].id);
    await pool.execute(
      `UPDATE camps
       SET location_text = ?, camp_date_text = ?, start_date_text = ?, end_date_text = ?, start_time_text = ?, end_time_text = ?, organizer_user_id = ?, organizer_role_text = ?,
           description_text = ?, expected_donors = ?, status_text = ?, updated_at_ts = ?
       WHERE id = ?`,
      [
        camp.location,
        camp.startDate,
        camp.startDate,
        camp.endDate,
        camp.startTime,
        camp.endTime,
        camp.organizerUserId,
        camp.organizerRoleText,
        camp.description,
        camp.expectedDonors,
        camp.statusText,
        ts,
        id,
      ]
    );
    return id;
  }

  const [insert] = await pool.execute(
    `INSERT INTO camps
     (camp_name, location_text, camp_date_text, start_date_text, end_date_text, start_time_text, end_time_text, organizer_user_id, organizer_role_text,
      description_text, expected_donors, status_text, created_at_ts, updated_at_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      camp.campName,
      camp.location,
      camp.startDate,
      camp.startDate,
      camp.endDate,
      camp.startTime,
      camp.endTime,
      camp.organizerUserId,
      camp.organizerRoleText,
      camp.description,
      camp.expectedDonors,
      camp.statusText,
      ts,
      ts,
    ]
  );
  return Number(insert.insertId);
};

const ensureRegistration = async (campId, donorId, statusText, ts) => {
  await pool.execute(
    `INSERT INTO camp_registrations (camp_id, donor_user_id, status_text, created_at_ts, updated_at_ts)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status_text = VALUES(status_text), updated_at_ts = VALUES(updated_at_ts)`,
    [campId, donorId, statusText, ts, ts]
  );
};

const ensureAttendance = async (campId, donorId, arrived, donated, units, markerId, ts) => {
  await pool.execute(
    `INSERT INTO camp_attendance
     (camp_id, donor_user_id, arrived_flag, donated_flag, units_collected, marked_by_user_id, marked_at_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE arrived_flag = VALUES(arrived_flag), donated_flag = VALUES(donated_flag),
       units_collected = VALUES(units_collected), marked_by_user_id = VALUES(marked_by_user_id), marked_at_ts = VALUES(marked_at_ts)`,
    [campId, donorId, arrived ? 1 : 0, donated ? 1 : 0, Number(units || 0), markerId || null, ts]
  );
};

const ensureDonation = async (campId, donorId, units, dateText, ts) => {
  await pool.execute(
    `INSERT INTO camp_donations (camp_id, donor_id, units, donation_date_text, status_text, created_at_ts)
     VALUES (?, ?, ?, ?, 'completed', ?)
     ON DUPLICATE KEY UPDATE units = VALUES(units), donation_date_text = VALUES(donation_date_text), created_at_ts = VALUES(created_at_ts)`,
    [campId, donorId, Number(units || 1), dateText, ts]
  );
};

const run = async () => {
  const ts = nowTs();
  const { adminId, hospitalId, donorIds } = await getUserIds();
  if (!adminId || !hospitalId || donorIds.length < 3) {
    throw new Error("Not enough base users. Need at least 1 admin, 1 hospital, 3 donors.");
  }

  const camps = [
    {
      campName: "Nashik Mega Blood Camp",
      location: "Nashik",
      startDate: "2026-03-05",
      endDate: "2026-03-06",
      startTime: "09:00",
      endTime: "15:00",
      organizerUserId: hospitalId,
      organizerRoleText: "hospital",
      description: "City blood drive with emergency stock focus.",
      expectedDonors: 70,
      statusText: "upcoming",
    },
    {
      campName: "Pune College Donation Drive",
      location: "Pune",
      startDate: "2026-03-10",
      endDate: "2026-03-12",
      startTime: "10:00",
      endTime: "16:00",
      organizerUserId: adminId,
      organizerRoleText: "admin",
      description: "Campus youth donor awareness and collection.",
      expectedDonors: 90,
      statusText: "upcoming",
    },
    {
      campName: "Mumbai Central Camp",
      location: "Mumbai",
      startDate: "2026-02-28",
      endDate: "2026-03-01",
      startTime: "08:30",
      endTime: "14:00",
      organizerUserId: adminId,
      organizerRoleText: "admin",
      description: "High-volume day camp for critical blood groups.",
      expectedDonors: 120,
      statusText: "ongoing",
    },
    {
      campName: "Dhule Weekend Blood Camp",
      location: "Dhule",
      startDate: "2026-02-20",
      endDate: "2026-02-20",
      startTime: "09:30",
      endTime: "13:30",
      organizerUserId: hospitalId,
      organizerRoleText: "hospital",
      description: "Regional donation camp with local NGO support.",
      expectedDonors: 45,
      statusText: "completed",
    },
    {
      campName: "Jalgoan Industrial Camp",
      location: "Jalgoan",
      startDate: "2026-02-15",
      endDate: "2026-02-15",
      startTime: "10:30",
      endTime: "14:30",
      organizerUserId: hospitalId,
      organizerRoleText: "hospital",
      description: "Factory-area blood donation outreach.",
      expectedDonors: 50,
      statusText: "cancelled",
    },
  ];

  const campIds = {};
  for (const camp of camps) {
    campIds[camp.campName] = await upsertCamp(camp, ts);
  }

  const [d1, d2, d3, d4] = donorIds;

  await ensureRegistration(campIds["Nashik Mega Blood Camp"], d1, "registered", ts);
  await ensureRegistration(campIds["Nashik Mega Blood Camp"], d2, "registered", ts);
  await ensureRegistration(campIds["Pune College Donation Drive"], d2, "registered", ts);
  await ensureRegistration(campIds["Pune College Donation Drive"], d3, "registered", ts);
  await ensureRegistration(campIds["Mumbai Central Camp"], d1, "registered", ts);
  await ensureRegistration(campIds["Mumbai Central Camp"], d3, "registered", ts);
  await ensureRegistration(campIds["Dhule Weekend Blood Camp"], d1, "registered", ts);
  await ensureRegistration(campIds["Dhule Weekend Blood Camp"], d2, "registered", ts);
  await ensureRegistration(campIds["Dhule Weekend Blood Camp"], d3, "registered", ts);
  if (d4) {
    await ensureRegistration(campIds["Jalgoan Industrial Camp"], d4, "cancelled", ts);
  }

  await ensureAttendance(campIds["Mumbai Central Camp"], d1, true, true, 1, adminId, ts);
  await ensureAttendance(campIds["Mumbai Central Camp"], d3, true, false, 0, adminId, ts);
  await ensureDonation(campIds["Mumbai Central Camp"], d1, 1, "2026-02-28", ts);

  await ensureAttendance(campIds["Dhule Weekend Blood Camp"], d1, true, true, 1, hospitalId, ts);
  await ensureAttendance(campIds["Dhule Weekend Blood Camp"], d2, true, true, 1, hospitalId, ts);
  await ensureAttendance(campIds["Dhule Weekend Blood Camp"], d3, true, false, 0, hospitalId, ts);
  await ensureDonation(campIds["Dhule Weekend Blood Camp"], d1, 1, "2026-02-20", ts);
  await ensureDonation(campIds["Dhule Weekend Blood Camp"], d2, 1, "2026-02-20", ts);

  const [[campCount]] = await pool.execute("SELECT COUNT(*) AS count FROM camps");
  const [[regCount]] = await pool.execute("SELECT COUNT(*) AS count FROM camp_registrations");
  const [[attendanceCount]] = await pool.execute("SELECT COUNT(*) AS count FROM camp_attendance");
  const [[donationCount]] = await pool.execute("SELECT COUNT(*) AS count FROM camp_donations");

  console.log(
    JSON.stringify(
      {
        message: "Camp seed completed.",
        totals: {
          camps: Number(campCount.count || 0),
          registrations: Number(regCount.count || 0),
          attendance: Number(attendanceCount.count || 0),
          donations: Number(donationCount.count || 0),
        },
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error("Camp seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {}
  });
