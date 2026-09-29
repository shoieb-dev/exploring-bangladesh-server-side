const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const bookingsController = require("../controllers/bookings.controller");

const router = express.Router();

// Legacy routes used by the old frontend:
//   GET    /myPackages/:email   -> bookings by email
//   DELETE /myPackages/:email   -> delete one booking by email
router.get("/:email", asyncHandler(bookingsController.getBookingsByEmail));
router.delete("/:email", asyncHandler(bookingsController.deleteOneBookingByEmail));

module.exports = router;
