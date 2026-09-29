const connectToDatabase = require("../../db");
const { getCollections } = require("../../db");
const { isValidObjectId, toObjectId } = require("../utils/ids");

async function getBookingsCollection() {
  const db = await connectToDatabase();
  return getCollections(db).bookings;
}

async function createBooking(req, res) {
  if (!req.body || !req.body.email) {
    return res.status(400).json({ success: false, message: "Booking email is required" });
  }
  const result = await (await getBookingsCollection()).insertOne({
    ...req.body,
    status: req.body.status || "pending",
    createdAt: new Date(),
  });
  res.status(201).json({ success: true, data: result });
}

// GET all bookings (admin/debug) with optional ?email= filter
async function getAllBookings(req, res) {
  const col = await getBookingsCollection();
  const filter = req.query.email ? { email: req.query.email } : {};
  const bookings = await col.find(filter).toArray();
  res.json({ success: true, count: bookings.length, data: bookings });
}

// GET bookings by email — canonical route: /api/bookings/email/:email
// Legacy alias kept: /myPackages/:email
async function getBookingsByEmail(req, res) {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email param is required" });
  }
  const bookings = await (await getBookingsCollection()).find({ email }).toArray();
  res.json({ success: true, count: bookings.length, data: bookings });
}

// DELETE single booking by id — canonical route: /api/bookings/:id
async function deleteBookingById(req, res) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid booking id" });
  }
  const result = await (await getBookingsCollection()).deleteOne({ _id: toObjectId(id) });
  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }
  res.json({ success: true, data: result });
}

// Legacy: DELETE /myPackages/:email deleted ONE booking by email.
// Kept for backward compat but prefer DELETE /api/bookings/:id.
async function deleteOneBookingByEmail(req, res) {
  const { email } = req.params;
  const result = await (await getBookingsCollection()).deleteOne({ email });
  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: "No booking found for this email" });
  }
  res.json({ success: true, data: result });
}

module.exports = {
  createBooking,
  getAllBookings,
  getBookingsByEmail,
  deleteBookingById,
  deleteOneBookingByEmail,
};
