import express from "express";
import { generateSignedUrl } from "../../utils/s3.js";
import fileModel from "../../models/fileModel.js"; // Example: your DB model

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const file = await fileModel.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const signedUrl = await generateSignedUrl(file.key, file.name, false);

    res.redirect(signedUrl);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Failed to generate download link" });
  }
});

export default router;
