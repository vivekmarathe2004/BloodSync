const express = require("express");
const { getLandingStats } = require("../controllers/publicController");
const { getPublicCamps } = require("../controllers/campController");

const router = express.Router();

router.get("/landing", getLandingStats);
router.get("/camps", getPublicCamps);

module.exports = router;
