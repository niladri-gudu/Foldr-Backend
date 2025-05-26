import express from "express";
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";

const router = express.Router();

// Get all trashed files for the logged in user
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
             isDeleted: true 
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });

        res.status(200).json({ files });

    } catch (error) {
        console.error('Error fetching trash files:', error);
        res.status(500).json({ message: 'Error fetching trash files' });
    }
})

// Move a file to trash
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

        const file = await fileModel.findById({ _id: fileId });
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        if (!file.userId.equals(user._id)) {
            return res.status(403).json({ error: "Forbidden: You do not have permission to access this file" });
        }

        user.files.pull(file._id)
        user.deleted.push(file._id)
        file.isDeleted = true

        await user.save();
        await file.save();

        res.status(200).json({ message: "File deleted successfully" });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'Error deleting file' });
    }
})

export default router;