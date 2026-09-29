const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const apiRoutes = require("./routes");
const legacyRoutes = require("./routes/legacy.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "Exploring Bangladesh Backend Running!",
      version: "2.0.0",
    });
  });

  app.get("/health", (req, res) => {
    res.json({ success: true, status: "ok", time: new Date().toISOString() });
  });

  // Canonical API
  app.use("/api", apiRoutes);

  // Backward-compatible top-level routes (old frontend):
  //   GET /packages, GET /packages/:id, POST /packages, DELETE /packages/:id
  //   POST /bookings
  const packagesRoutes = require("./routes/packages.routes");
  const bookingsRoutes = require("./routes/bookings.routes");
  app.use("/packages", packagesRoutes);
  // Only POST /bookings existed at top level historically; mount full router anyway
  // so GET /bookings?email= works too.
  app.use("/bookings", bookingsRoutes);

  // Legacy: /myPackages/:email
  app.use("/myPackages", legacyRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
