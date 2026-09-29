const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { ObjectId } = require("mongodb");
const connectToDatabase = require("./db");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// === ROUTES ===

// Home Route
app.get("/", (req, res) => {
  res.send("Exploring Bangladesh Backend Running!");
});

// GET All Packages
app.get("/packages", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const packages = await db.collection("packages").find({}).toArray();
    res.send(packages);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch packages");
  }
});

// GET Single Package by ID
app.get("/packages/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const package = await db.collection("packages").findOne({ _id: ObjectId(req.params.id) });
    res.json(package);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch package");
  }
});

// POST New Package
app.post("/packages", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("packages").insertOne(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to add package");
  }
});

// DELETE Package
app.delete("/packages/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("packages").deleteOne({ _id: ObjectId(req.params.id) });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to delete package");
  }
});

// POST New Booking
app.post("/bookings", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("bookings").insertOne(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to add booking");
  }
});

// GET Bookings by Email
app.get("/myPackages/:email", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("bookings").find({ email: req.params.email }).toArray();
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch bookings");
  }
});

// DELETE Booking by Email
app.delete("/myPackages/:email", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("bookings").deleteOne({ email: req.params.email });
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to delete booking");
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Exploring Bangladesh server running at http://localhost:${port}`);
});
