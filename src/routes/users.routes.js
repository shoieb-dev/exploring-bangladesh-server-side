const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { optionalAuth, requireAuth, requireAdminOrAllowlist } = require("../middleware/auth");
const controller = require("../controllers/users.controller");

const router = express.Router();

// Public role lookup for frontend gating (user vs admin UI).
router.get("/me", asyncHandler(controller.getMyRole));

// Public sync endpoint — frontend calls after Firebase login (Google or email).
router.post("/upsert", asyncHandler(controller.upsertUser));

// Derived list — works without Firebase Admin configured.
router.get("/from-bookings", asyncHandler(controller.getUsersFromBookings));

// Admin list. Requires Firebase ID token when Firebase Admin is configured
// (Bearer <idToken>); falls back to open in pure-mongo/bookings mode.
router.get("/", optionalAuth, (req, res, next) => {
  const { getFirebaseAdmin } = require("../config/firebase");
  if (getFirebaseAdmin() && !req.firebaseUser) {
    return requireAuth(req, res, () =>
      requireAdminOrAllowlist(req, res, () => controller.getAllUsers(req, res).catch(next))
    );
  }
  if (req.firebaseUser) {
    return requireAdminOrAllowlist(req, res, () =>
      controller.getAllUsers(req, res).catch(next)
    );
  }
  return asyncHandler(controller.getAllUsers)(req, res, next);
});

// Single synced user by Mongo _id or email (last — avoids shadowing).
router.get("/:idOrEmail", asyncHandler(controller.getUserByIdOrEmail));

// Promote/demote — admin only (needs Bearer token of an admin).
router.patch(
  "/:idOrEmail/role",
  requireAuth,
  requireAdminOrAllowlist,
  asyncHandler(controller.setUserRole)
);

module.exports = router;
