const connectToDatabase = require("../../db");
const { getCollections } = require("../../db");
const { isValidObjectId, toObjectId } = require("../utils/ids");

async function getPackagesCollection() {
  const db = await connectToDatabase();
  return getCollections(db).packages;
}

async function getAllPackages(req, res) {
  const packages = await (await getPackagesCollection()).find({}).toArray();
  res.json({ success: true, count: packages.length, data: packages });
}

async function getPackageById(req, res) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid package id" });
  }
  const pkg = await (await getPackagesCollection()).findOne({ _id: toObjectId(id) });
  if (!pkg) {
    return res.status(404).json({ success: false, message: "Package not found" });
  }
  res.json({ success: true, data: pkg });
}

async function createPackage(req, res) {
  const { name, title } = req.body || {};
  if (!req.body || (!name && !title)) {
    return res.status(400).json({ success: false, message: "Package body is required (at least name/title)" });
  }
  const result = await (await getPackagesCollection()).insertOne({
    ...req.body,
    createdAt: new Date(),
  });
  res.status(201).json({ success: true, data: result });
}

async function deletePackage(req, res) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid package id" });
  }
  const result = await (await getPackagesCollection()).deleteOne({ _id: toObjectId(id) });
  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: "Package not found" });
  }
  res.json({ success: true, data: result });
}

module.exports = {
  getAllPackages,
  getPackageById,
  createPackage,
  deletePackage,
};
