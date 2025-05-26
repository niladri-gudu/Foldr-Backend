import express from "express";
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";

const router = express.Router();

// Get all starred files for the logged in user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.user
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: missing userId" });
        }

        const user = await userModel.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const files = await fileModel.find({
             userId: user._id, 
             starred: true,
             isDeleted: false 
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });

        res.status(200).json({ files });

    } catch (error) {
        console.error('Error fetching starred files:', error);
        res.status(500).json({ message: 'Error fetching starred files' });
    }
})

// Star or unstar a file
router.post('/:id', async (req, res) => {
    
    try {
        const { userId } = req.user
        const fileId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: missing userId" });
        }

        const user = await userModel.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const file = await fileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" })
        }

        if (!file.userId.equals(user._id)) {
            return res.status(403).json({ error: "Forbidden: You do not have permission to star this file" });
        }

        file.starred = !file.starred;
        await file.save();

        res.status(200).json({ message: "File starred status updated", file: { starred: file.starred } });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed' });
    }
})

export default router;