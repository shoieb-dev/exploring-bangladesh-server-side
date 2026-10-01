const { getFirebaseAdmin } = require("../config/firebase");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  return null;
}

/**
 * Optional auth: attaches req.firebaseUser (decoded ID token) if a valid
 * Bearer token is present. Never rejects — public routes keep working.
 */
function optionalAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return next();
  const admin = getFirebaseAdmin();
  if (!admin) return next();
  admin
    .auth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.firebaseUser = decoded;
      next();
    })
    .catch(() => next());
}

/**
 * Required auth: 401 when no valid Bearer ID token is provided.
 */
function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const admin = getFirebaseAdmin();
  if (!admin) {
    return res.status(503).json({
      success: false,
      message: "Auth not configured. Set Firebase Admin env vars on the server.",
    });
  }
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing Authorization: Bearer <idToken>" });
  }
  admin
    .auth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.firebaseUser = decoded;
      next();
    })
    .catch(() =>
      res.status(401).json({ success: false, message: "Invalid or expired Firebase ID token" })
    );
}

/**
 * Admin gate. Order of trust:
 * 1. Firebase custom claim admin:true (synced by backend)
 * 2. Mongo users.role === "admin" (checked async when Bearer token present)
 * 3. ADMIN_EMAILS / BOOTSTRAP_ADMIN_EMAIL allowlist
 * Open when no allowlist is set (dev convenience) — set ADMIN_EMAILS in production.
 */
function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return email ? list.includes(String(email).toLowerCase()) : false;
}

function requireAdminOrAllowlist(req, res, next) {
  const email = req.firebaseUser && req.firebaseUser.email;
  const claimAdmin = req.firebaseUser && req.firebaseUser.admin === true;
  if (claimAdmin) return next();
  // check Mongo role — needs DB lookup, so make this middleware async-capable
  const { getCollections } = require("../../db");
  const connectToDatabase = require("../../db");
  connectToDatabase()
    .then((db) => getCollections(db).users.findOne({ email: String(email || "").toLowerCase() }))
    .then((doc) => {
      if (doc && doc.role === "admin") return next();
      if (isAdminEmail(email)) return next();
      return res.status(403).json({ success: false, message: "Admin access required" });
    })
    .catch(next);
}

module.exports = { optionalAuth, requireAuth, requireAdminOrAllowlist, isAdminEmail };
