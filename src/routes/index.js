const express = require("express");
const packagesRoutes = require("./packages.routes");
const bookingsRoutes = require("./bookings.routes");
const usersRoutes = require("./users.routes");

const router = express.Router();

router.use("/packages", packagesRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/users", usersRoutes);

module.exports = router;
