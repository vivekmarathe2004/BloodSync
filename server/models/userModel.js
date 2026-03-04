const pool = require("../config/db");
const isMissingColumnError = (error) => error && error.code === "ER_BAD_FIELD_ERROR";

const runUserUpdateWithFallbacks = async (queries) => {
  let lastMissingColumnError = null;
  for (const query of queries) {
    try {
      const [result] = await pool.execute(query.sql, query.params);
      return result.affectedRows > 0;
    } catch (error) {
      if (isMissingColumnError(error)) {
        lastMissingColumnError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastMissingColumnError) {
    throw lastMissingColumnError;
  }
  return false;
};

const createUser = async ({ name, email, password, role, phone, city, state, latitude, longitude, createdBy, isSuperAdmin }) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO users
      (name, email, password, role, phone, city, state, latitude, longitude, created_by, is_super_admin, deleted_at_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name,
        email,
        password,
        role,
        phone,
        city,
        state || null,
        latitude || null,
        longitude || null,
        createdBy || null,
        isSuperAdmin ? 1 : 0,
      ]
    );
    return result.insertId;
  } catch (error) {
    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      const [result] = await pool.execute(
        "INSERT INTO users (name, email, password, role, phone, city) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, password, role, phone, city]
      );
      return result.insertId;
    }
    throw error;
  }
};

const findUserByEmail = async (email) => {
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0];
};

const findUserById = async (id) => {
  const queries = [
    {
      sql: `SELECT id, name, email, role, phone, city, is_active, is_super_admin, deleted_at_ts, created_at
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
    {
      sql: `SELECT id, name, email, role, phone, city, 1 AS is_active, is_super_admin, deleted_at_ts, created_at
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
    {
      sql: `SELECT id, name, email, role, phone, city, is_active, is_super_admin, 0 AS deleted_at_ts, created_at
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
    {
      sql: `SELECT id, name, email, role, phone, city, 1 AS is_active, 0 AS is_super_admin, 0 AS deleted_at_ts, created_at
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
  ];

  let lastMissingColumnError = null;
  for (const query of queries) {
    try {
      const [rows] = await pool.execute(query.sql, query.params);
      return rows[0];
    } catch (error) {
      if (isMissingColumnError(error)) {
        lastMissingColumnError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastMissingColumnError) throw lastMissingColumnError;
  return null;
};

const getUsers = async (query, role = "", dateFrom = "", dateTo = "") => {
  const search = `%${query || ""}%`;
  const params = [search, search, search];
  const clauses = ["(name LIKE ? OR email LIKE ? OR city LIKE ?)"];

  if (role) {
    clauses.push("role = ?");
    params.push(role);
  }
  if (dateFrom) {
    clauses.push("DATE(created_at) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push("DATE(created_at) <= ?");
    params.push(dateTo);
  }

  const queries = [
    `SELECT id, name, email, role, phone, city, state, is_active, is_super_admin, deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, state, 1 AS is_active, is_super_admin, deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, state, is_active, is_super_admin, 0 AS deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, state, 1 AS is_active, 0 AS is_super_admin, 0 AS deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, NULL AS state, is_active, is_super_admin, deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, NULL AS state, 1 AS is_active, is_super_admin, deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, NULL AS state, is_active, is_super_admin, 0 AS deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
    `SELECT id, name, email, role, phone, city, NULL AS state, 1 AS is_active, 0 AS is_super_admin, 0 AS deleted_at_ts, created_at
     FROM users
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC`,
  ];

  let lastMissingColumnError = null;
  for (const sql of queries) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      if (isMissingColumnError(error)) {
        lastMissingColumnError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastMissingColumnError) throw lastMissingColumnError;
  return [];
};

const deleteUserById = async (id) => {
  const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

const setUserActiveStatus = async (id, isActive) => {
  const status = isActive ? 1 : 0;
  const deletedAtTs = isActive ? 0 : Math.floor(Date.now() / 1000);

  return runUserUpdateWithFallbacks([
    {
      sql: "UPDATE users SET is_active = ?, deleted_at_ts = ? WHERE id = ?",
      params: [status, deletedAtTs, id],
    },
    {
      sql: "UPDATE users SET is_active = ? WHERE id = ?",
      params: [status, id],
    },
    {
      sql: "UPDATE users SET deleted_at_ts = ? WHERE id = ?",
      params: [deletedAtTs, id],
    },
  ]);
};

const updateUserRole = async (id, role) => {
  const [result] = await pool.execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  return result.affectedRows > 0;
};

const getUserByIdForAdmin = async (id) => {
  const queries = [
    {
      sql: `SELECT id, name, email, role, phone, city, is_active, is_super_admin, deleted_at_ts
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
    {
      sql: `SELECT id, name, email, role, phone, city, 1 AS is_active, is_super_admin, deleted_at_ts
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
    {
      sql: `SELECT id, name, email, role, phone, city, is_active, is_super_admin, 0 AS deleted_at_ts
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
    {
      sql: `SELECT id, name, email, role, phone, city, 1 AS is_active, 0 AS is_super_admin, 0 AS deleted_at_ts
            FROM users
            WHERE id = ?
            LIMIT 1`,
      params: [id],
    },
  ];

  let lastMissingColumnError = null;
  for (const query of queries) {
    try {
      const [rows] = await pool.execute(query.sql, query.params);
      return rows[0];
    } catch (error) {
      if (isMissingColumnError(error)) {
        lastMissingColumnError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastMissingColumnError) throw lastMissingColumnError;
  return null;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  getUsers,
  deleteUserById,
  setUserActiveStatus,
  updateUserRole,
  getUserByIdForAdmin,
};
