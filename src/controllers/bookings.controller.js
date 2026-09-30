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
// SMART version: old frontend actually calls DELETE /myPackages/:bookingId
// (booking _id, e.g. 617eb4f4344f6035d4b923c9), NOT the email.
// So accept BOTH: if param looks like an ObjectId -> delete by _id,
// otherwise delete by email.
async function deleteLegacyMyPackage(req, res) {
  const { email: param } = req.params;
  if (!param) {
    return res.status(400).json({ success: false, message: "Booking id or email is required" });
  }
  const col = await getBookingsCollection();

  let result;
  if (isValidObjectId(param)) {
    result = await col.deleteOne({ _id: toObjectId(param) });
  } else {
    result = await col.deleteOne({ email: param });
  }

  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: "No booking found" });
  }
  res.json({ success: true, data: result });
}

module.exports = {
  createBooking,
  getAllBookings,
  getBookingsByEmail,
  deleteBookingById,
  deleteLegacyMyPackage,
  // alias kept so old imports don't break
  deleteOneBookingByEmail: deleteLegacyMyPackage,
};
