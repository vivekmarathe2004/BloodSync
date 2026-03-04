const express = require("express");
const { body } = require("express-validator");
const { register, login, me, logout } = require("../controllers/authController");
const { handleValidation } = require("../middleware/validateMiddleware");
const { protect } = require("../middleware/authMiddleware");
const { CITY_OPTIONS, BLOOD_GROUP_OPTIONS } = require("../constants/options");

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty(),
    body("email").isEmail(),
    body("password").isLength({ min: 8 }),
    body("role").isIn(["donor", "hospital"]),
    body("city").isIn(CITY_OPTIONS),
    body("bloodGroup").if(body("role").equals("donor")).isIn(BLOOD_GROUP_OPTIONS),
    body("age").if(body("role").equals("donor")).isInt({ min: 18, max: 65 }),
    body("gender").if(body("role").equals("donor")).isIn(["male", "female", "other"]),
    body("hospitalName").if(body("role").equals("hospital")).trim().notEmpty(),
    body("address").if(body("role").equals("hospital")).trim().notEmpty(),
  ],
  handleValidation,
  register
);

router.post("/login", [body("email").isEmail(), body("password").notEmpty()], handleValidation, login);
router.get("/me", protect, me);
router.post("/logout", logout);

module.exports = router;
