let admin;
let initError = null;

function getFirebaseAdmin() {
  if (admin) return admin;

  try {
    // Lazy require so the server still boots without firebase-admin
    // installed / configured (local dev without service account).
    // eslint-disable-next-line global-require
    const adminLib = require("firebase-admin");

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined;

    if (!projectId || !clientEmail || !privateKey) {
      initError = new Error(
        "Firebase Admin not configured. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY"
      );
      return null;
    }

    if (!adminLib.apps.length) {
      adminLib.initializeApp({
        credential: adminLib.credential.cert({ projectId, clientEmail, privateKey }),
      });
      console.log("Firebase Admin initialized");
    }
    admin = adminLib;
    return admin;
  } catch (err) {
    initError = err;
    return null;
  }
}

function isFirebaseConfigured() {
  return Boolean(getFirebaseAdmin());
}

function getFirebaseInitError() {
  getFirebaseAdmin();
  return initError;
}

module.exports = { getFirebaseAdmin, isFirebaseConfigured, getFirebaseInitError };
