import express from "express";
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";
import { generateSignedUrl } from "../../utils/s3.js";
import sharedFileModel from "../../models/sharedFileModel.js";

const router = express.Router();

// Get all files for the logged in user
router.get("/", async (req, res) => {

    console.log("Fetching all files for user...");
    try {
        const { userId } = req.user;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await userModel.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const files = await fileModel.find({
            _id: { $in: user.files },
            isDeleted: false
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })

        res.status(200).json({ files })

    } catch (error) {
        console.error("Failed to fetch files:", error);
        res.status(500).json({ message: "Failed to fetch files" });
    }
})

// Get a single file for the logged in user
router.get("/:id", async (req, res) => {
    
    try {
        const { userId } = req.user;
        const fileId = req.params.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await userModel.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const file = await fileModel.findOne({ _id: fileId }).populate('userId', 'name email');
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        const isOwner = file.userId._id.equals(user._id)
        if (!isOwner) {
            const sharedFile = await sharedFileModel.findOne({
                fileId: file._id,
                sharedWithIds: user._id
            })
            if (!sharedFile) {
                return res.status(403).json({ error: "Forbidden: You do not have permission to access this file" });
            }
        }

        const signedUrl = await generateSignedUrl(file.key);

        console.log("File fetched successfully:", file);

        res.status(200).json({ 
            file: {
                _id: file._id,
                name: file.name,
                type: file.type,
                size: file.size,
                user: file.userId,
                url: signedUrl,
            }
        });

    } catch (error) {
        console.error("Failed to fetch file:", error);
        res.status(500).json({ message: "Failed to fetch file" });
    }
})

export default router;