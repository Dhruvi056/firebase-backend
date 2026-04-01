const express = require("express");
const router = express.Router();
const { getSubmissions, deleteSubmission, resolveSubmissionFile, getLatestSubmissionByForms } = require("../controllers/submissionController");
const { protect } = require("../middlewares/authMiddleware");

// Submissions for a specific form
router.get("/:formId", protect, getSubmissions);

// Latest submission timestamps by form (for notifications)
router.post("/latest", protect, getLatestSubmissionByForms);

// Resolve legacy filename-only submission file to a real URL
router.post("/resolve-file", protect, resolveSubmissionFile);

// Delete a specific submission (soft delete)
router.delete("/:id", protect, deleteSubmission);

module.exports = router;
