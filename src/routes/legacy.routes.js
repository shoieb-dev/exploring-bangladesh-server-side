const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const bookingsController = require("../controllers/bookings.controller");

const router = express.Router();

// Legacy routes used by the old frontend:
//   GET    /myPackages/:email     -> bookings by email
//   DELETE /myPackages/:bookingId -> delete one booking by _id
//          (frontend passes booking._id, e.g. 617eb4f4344f6035d4b923c9)
//   DELETE /myPackages/:email     -> (fallback) delete one booking by email
router.get("/:email", asyncHandler(bookingsController.getBookingsByEmail));
router.delete("/:email", asyncHandler(bookingsController.deleteLegacyMyPackage));

module.exports = router;
