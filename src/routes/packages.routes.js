const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/packages.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.getAllPackages));
router.get("/:id", asyncHandler(controller.getPackageById));
router.post("/", asyncHandler(controller.createPackage));
router.delete("/:id", asyncHandler(controller.deletePackage));

module.exports = router;
