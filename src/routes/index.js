const express = require("express");
const packagesRoutes = require("./packages.routes");
const bookingsRoutes = require("./bookings.routes");

const router = express.Router();

router.use("/packages", packagesRoutes);
router.use("/bookings", bookingsRoutes);

module.exports = router;
