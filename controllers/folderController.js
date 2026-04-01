const Folder = require("../models/folderModel");

// Get all folders for a user
const getFolders = async (req, res) => {
  try {
    const query = {};

    // User model has no vendorId; vendor_admin must filter by owner (same as Firebase "my folders")
    if (req.user.role !== "super_admin") {
      query.user = req.user._id;
    }

    const folders = await Folder.find(query).sort("-createdAt");
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new folder
const createFolder = async (req, res) => {
  try {
    const { name, vendorId } = req.body;
    if (!name) return res.status(400).json({ message: "Folder name is required" });

    const folder = await Folder.create({
      user: req.user._id,
      name,
      vendorId: vendorId || String(req.user._id),
    });

    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getFolders, createFolder };
