const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/bookings.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.getAllBookings));
router.post("/", asyncHandler(controller.createBooking));
router.get("/email/:email", asyncHandler(controller.getBookingsByEmail));
router.delete("/:id", asyncHandler(controller.deleteBookingById));

module.exports = router;
