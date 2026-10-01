const connectToDatabase = require("../../db");
const { getCollections } = require("../../db");
const { isValidObjectId, toObjectId } = require("../utils/ids");
const { getFirebaseAdmin } = require("../config/firebase");

async function getUsersCollection() {
  const db = await connectToDatabase();
  return getCollections(db).users;
}

/**
 * Admin bootstrap + role helpers.
 * - Roles live in Mongo `users.role`: "user" | "admin" (default "user").
 * - First-admin problem solved via ADMIN_EMAILS / BOOTSTRAP_ADMIN_EMAIL env:
 *   any upsert whose email matches the allowlist is auto-promoted to admin,
 *   even if no admins exist yet.
 * - Firebase custom claim `admin:true` is synced when possible so the
 *   frontend ID token carries the role too.
 */
function getAdminAllowlist() {
  const raw = process.env.ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAIL || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlistedAdminEmail(email) {
  const list = getAdminAllowlist();
  if (!email || list.length === 0) return false;
  return list.includes(String(email).toLowerCase());
}

async function syncFirebaseAdminClaim(uid, isAdmin) {
  try {
    if (!uid) return false;
    const { getFirebaseAdmin } = require("../config/firebase");
    const admin = getFirebaseAdmin();
    if (!admin) return false;
    const user = await admin.auth().getUser(uid).catch(() => null);
    if (!user) return false;
    const claims = (user.customClaims || {});
    if (isAdmin && claims.admin === true) return true;
    if (!isAdmin && !claims.admin) return true;
    await admin.auth().setCustomUserClaims(uid, { ...claims, admin: isAdmin });
    return true;
  } catch (err) {
    console.error("syncFirebaseAdminClaim failed:", err.message);
    return false;
  }
}

async function ensureBootstrapAdmin(col, email, uid) {
  const normalized = String(email).toLowerCase();
  if (!isAllowlistedAdminEmail(normalized)) return null;
  const existing = await col.findOne({ email: normalized });
  if (existing && existing.role === "admin") return existing;
  const now = new Date();
  await col.updateOne(
    { email: normalized },
    {
      $set: { role: "admin", updatedAt: now, lastLoginAt: now },
      $setOnInsert: { uid: uid || null, email: normalized, createdAt: now },
    },
    { upsert: true }
  );
  const doc = await col.findOne({ email: normalized });
  if (doc) await syncFirebaseAdminClaim(doc.uid || uid, true);
  return doc;
}

function toUserDto(doc) {
  if (!doc) return doc;
  return {
    id: String(doc._id),
    uid: doc.uid || null,
    email: doc.email,
    displayName: doc.displayName || doc.name || null,
    photoURL: doc.photoURL || null,
    provider: doc.provider || (doc.uid ? "firebase" : "email"),
    role: doc.role || "user",
    lastLoginAt: doc.lastLoginAt || null,
    createdAt: doc.createdAt || null,
  };
}

function toFirebaseUserDto(u, mongoByEmail) {
  const mongo = mongoByEmail && u.email
    ? mongoByEmail[String(u.email).toLowerCase()]
    : null;
  return {
    uid: u.uid,
    email: u.email || null,
    displayName: u.displayName || null,
    photoURL: u.photoURL || null,
    provider: (u.providerData || []).map((p) => p.providerId),
    emailVerified: Boolean(u.emailVerified),
    disabled: Boolean(u.disabled),
    role: (mongo && mongo.role) || (u.customClaims && u.customClaims.admin ? "admin" : "user"),
    isAdmin: (mongo && mongo.role === "admin") || Boolean(u.customClaims && u.customClaims.admin),
    createdAt: u.metadata && u.metadata.creationTime ? new Date(u.metadata.creationTime) : null,
    lastSignInAt:
      u.metadata && u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime) : null,
  };
}

/**
 * GET /api/users
 * Query: ?source=firebase|mongo|auto (default auto), ?role=user|admin,
 *        ?limit, ?pageToken (firebase only)
 *
 * Role model: Mongo `users.role` ("user" | "admin", default "user").
 * Firebase `?source=firebase` merges Mongo roles by email + exposes isAdmin.
 */
async function getAllUsers(req, res) {
  const source = String(req.query.source || "auto").toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);

  if (source === "mongo") {
    const filter = {};
    if (req.query.role === "admin" || req.query.role === "user") filter.role = req.query.role;
    const docs = await (await getUsersCollection()).find(filter).limit(limit).toArray();
    return res.json({ success: true, source: "mongo", count: docs.length, data: docs.map(toUserDto) });
  }

  if (source === "bookings") {
    return getUsersFromBookings(req, res);
  }

  if (source === "firebase") {
    return listFirebaseUsers(req, res, limit);
  }

  // auto
  const mongoCount = await (await getUsersCollection()).countDocuments();
  if (mongoCount > 0) {
    const filter = {};
    if (req.query.role === "admin" || req.query.role === "user") filter.role = req.query.role;
    const docs = await (await getUsersCollection()).find(filter).limit(limit).toArray();
    return res.json({ success: true, source: "mongo", count: docs.length, data: docs.map(toUserDto) });
  }
  const admin = getFirebaseAdmin();
  if (admin) {
    return listFirebaseUsers(req, res, limit);
  }
  return getUsersFromBookings(req, res);
}

async function listFirebaseUsers(req, res, limit) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return res.status(503).json({
      success: false,
      message:
        "Firebase Admin not configured. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, or use ?source=mongo / ?source=bookings",
    });
  }
  const pageToken = req.query.pageToken || undefined;
  const result = await admin.auth().listUsers(limit, pageToken);
  // merge Mongo roles by email so frontend sees role/isAdmin everywhere
  let mongoByEmail = {};
  try {
    const mongoDocs = await (await getUsersCollection()).find({}).toArray();
    mongoByEmail = Object.fromEntries(
      mongoDocs.filter((d) => d.email).map((d) => [String(d.email).toLowerCase(), d])
    );
  } catch (e) {
    mongoByEmail = {};
  }
  let data = result.users.map((u) => toFirebaseUserDto(u, mongoByEmail));
  if (req.query.role === "admin") data = data.filter((u) => u.isAdmin);
  if (req.query.role === "user") data = data.filter((u) => !u.isAdmin);
  return res.json({
    success: true,
    source: "firebase",
    count: data.length,
    pageToken: result.pageToken || null,
    data,
  });
}

/**
 * GET /api/users/from-bookings — distinct users derived from bookings.
 * Works with zero setup; only includes users who booked at least once.
 */
async function getUsersFromBookings(req, res) {
  const db = await connectToDatabase();
  const users = await db
    .collection("bookings")
    .aggregate([
      {
        $group: {
          _id: "$email",
          email: { $first: "$email" },
          displayName: { $first: "$name" },
          bookingsCount: { $sum: 1 },
          lastBookingAt: { $max: "$createdAt" },
        },
      },
      { $project: { _id: 0 } },
      { $sort: { bookingsCount: -1 } },
    ])
    .toArray();
  res.json({ success: true, source: "bookings", count: users.length, data: users });
}

/**
 * POST /api/users/upsert — call from frontend right after Firebase
 * sign-in (Google popup OR email/password). Creates/updates Mongo user.
 * Body: { uid?, email (required), displayName?, photoURL?, provider? }
 * Allowlisted emails (ADMIN_EMAILS) are auto-promoted to admin (bootstrap).
 */
async function upsertUser(req, res) {
  const { uid, email, displayName, name, photoURL, provider } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: "email is required" });
  }
  const now = new Date();
  const col = await getUsersCollection();
  const normalized = String(email).toLowerCase();
  // Bootstrap: first admin(s) come from ADMIN_EMAILS allowlist, no existing admin needed.
  const bootstrapAdmin = await ensureBootstrapAdmin(col, normalized, uid);
  if (bootstrapAdmin) {
    return res.json({ success: true, data: toUserDto(bootstrapAdmin) });
  }
  const update = {
    $set: {
      email: normalized,
      displayName: displayName || name || null,
      photoURL: photoURL || null,
      provider: provider || (uid ? "firebase" : "email"),
      lastLoginAt: now,
      updatedAt: now,
    },
    // NOTE: uid must live in ONLY ONE of $set / $setOnInsert, else Mongo throws
    // "Updating the path 'uid' would create a conflict at 'uid'".
    $setOnInsert: { role: "user", createdAt: now },
  };
  if (uid) {
    update.$set.uid = uid;
  } else {
    update.$setOnInsert.uid = null;
  }
  const result = await col.updateOne({ email: normalized }, update, {
    upsert: true,
  });
  const doc = await col.findOne({ email: normalized });
  res.status(result.upsertedCount ? 201 : 200).json({ success: true, data: toUserDto(doc) });
}

/**
 * GET /api/users/:idOrEmail — fetch one synced user by Mongo _id or email.
 */
async function getUserByIdOrEmail(req, res) {
  const { idOrEmail } = req.params;
  const col = await getUsersCollection();
  let doc = null;
  if (isValidObjectId(idOrEmail)) {
    doc = await col.findOne({ _id: toObjectId(idOrEmail) });
  }
  if (!doc) {
    doc = await col.findOne({ email: String(idOrEmail).toLowerCase() });
  }
  if (!doc) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({ success: true, source: "mongo", data: toUserDto(doc) });
}

/**
 * GET /api/users/me?email= — role lookup for the frontend.
 * Returns { role, isAdmin } so UI can show/hide admin links.
 * No auth required by design (email is public identifier); admin-only
 * listing stays behind requireAuth + requireAdminOrAllowlist.
 */
async function getMyRole(req, res) {
  const email = String(req.query.email || req.params.email || "").toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, message: "email query param is required" });
  }
  const col = await getUsersCollection();
  const doc = await col.findOne({ email });
  if (doc) {
    const role = doc.role || "user";
    return res.json({ success: true, data: { email, role, isAdmin: role === "admin" } });
  }
  // not synced yet — allowlisted emails are implicitly admin (will be on next login)
  const isAdmin = isAllowlistedAdminEmail(email);
  res.json({
    success: true,
    data: { email, role: isAdmin ? "admin" : "user", isAdmin, synced: false },
  });
}

/**
 * PATCH /api/users/:idOrEmail/role — set role (admin only).
 * Body: { role: "admin" | "user" }
 */
async function setUserRole(req, res) {
  const { idOrEmail } = req.params;
  const { role } = req.body || {};
  if (role !== "admin" && role !== "user") {
    return res.status(400).json({ success: false, message: 'role must be "admin" or "user"' });
  }
  const col = await getUsersCollection();
  let doc = null;
  if (isValidObjectId(idOrEmail)) {
    doc = await col.findOne({ _id: toObjectId(idOrEmail) });
  }
  if (!doc) {
    doc = await col.findOne({ email: String(idOrEmail).toLowerCase() });
  }
  if (!doc) {
    return res.status(404).json({ success: false, message: "User not found. Ask them to log in once first." });
  }
  await col.updateOne({ _id: doc._id }, { $set: { role, updatedAt: new Date() } });
  await syncFirebaseAdminClaim(doc.uid, role === "admin");
  const updated = await col.findOne({ _id: doc._id });
  res.json({ success: true, data: toUserDto(updated) });
}

module.exports = {
  getAllUsers,
  getUsersFromBookings,
  upsertUser,
  getUserByIdOrEmail,
  getMyRole,
  setUserRole,
  isAllowlistedAdminEmail,
};
