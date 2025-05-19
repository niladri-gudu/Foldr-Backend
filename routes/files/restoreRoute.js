import express from "express";
import fileModel from "../../models/fileModel.js";
import userModel from "../../models/userModel.js";

const router = express.Router();

// Restore a file from trash
router.post('/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const { userId } = req.auth
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: missing userId" });
        }

        const user = await userModel.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const file = await fileModel.findOne({ _id: fileId });
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        if (!file.userId.equals(user._id)) {
            return res.status(403).json({ error: "Forbidden: You do not have permission to access this file" });
        }

        user.files.push(fileId)
        user.deleted.pull(fileId)
        file.isDeleted = false

        await user.save();
        await file.save();

        res.status(200).json({ message: "File restored successfully" });
        
    } catch (error) {
        console.error('Error restoring file:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

export default router;