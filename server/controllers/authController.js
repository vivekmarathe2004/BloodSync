const bcrypt = require("bcryptjs");
const { signToken } = require("../utils/jwt");
const { createUser, findUserByEmail, findUserById } = require("../models/userModel");
const { createDonorProfile } = require("../models/donorModel");
const { createHospitalProfile } = require("../models/hospitalModel");

const cookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, city, state, latitude, longitude, bloodGroup, age, gender, hospitalName, address } =
      req.body;
    if (!["donor", "hospital"].includes(role)) {
      return res.status(400).json({ message: "Role must be donor or hospital." });
    }
    if (role === "donor" && (!bloodGroup || !age || !gender)) {
      return res.status(400).json({ message: "bloodGroup, age and gender are required for donor registration." });
    }
    if (role === "hospital" && (!hospitalName || !address)) {
      return res.status(400).json({ message: "hospitalName and address are required for hospital registration." });
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
      role,
      phone,
      city,
      state,
      latitude,
      longitude,
    });

    if (role === "donor") {
      await createDonorProfile({
        userId,
        bloodGroup,
        age: Number(age),
        gender,
      });
    }

    if (role === "hospital") {
      await createHospitalProfile({
        userId,
        hospitalName,
        address,
      });
    }

    return res.status(201).json({ message: "Registration successful." });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const isDisabled = Number(user?.is_active) === 0 || Number(user?.deleted_at_ts || 0) > 0;
    if (isDisabled) {
      return res.status(403).json({ message: "User account is disabled." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = signToken({ id: user.id, role: user.role, isSuperAdmin: Number(user.is_super_admin || 0) === 1 });
    res.cookie("token", token, cookieOptions);
    return res.status(200).json({
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        isSuperAdmin: Number(user.is_super_admin || 0) === 1,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await findUserById(req.user.id);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

const logout = (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({ message: "Logged out." });
};

module.exports = { register, login, me, logout };
