import express from "express";
import fileModel from "../../models/fileModel.js";
import userModel from "../../models/userModel.js";
import sharedFileModel from "../../models/sharedFileModel.js";

const router = express.Router();

// Validating a user to share a file with
router.post('/validate', async (req, res) => {
    const { email } = req.body;

    try {
        if (!req.auth || !req.auth.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const recipient = await userModel.findOne({ email });
        if (!recipient) {
            return res.status(404).json({ message: "User not found" });
        }

        const sender = await userModel.findOne({ clerkId: req.auth.userId });
        if (!sender) {
            return res.status(404).json({ message: "User not found" });
        }

        if (sender.clerkId === recipient.clerkId) {
            return res.status(400).json({ message: "You cannot share a file with yourself" });
        }

        res.status(200).json({ message: "User found", user: { email: recipient.email, clerkId: recipient.clerkId, name: recipient.name } });

    } catch (error) {
        console.error("error in validating user", error);
        return res.status(500).json({ message: "Internal server error" });
    }
})

// Get all shared files for the logged in user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.auth;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await userModel.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const sharedWithMe = await sharedFileModel.find({
            sharedWithIds: user.clerkId
        })
        .populate('fileId')
        .populate('sharedBy', 'name email')
        .sort({ createdAt: -1 });

        res.status(200).json({ message: "Shared files retrieved successfully", sharedWithMe });

    } catch (error) {
        console.error("error in getting shared files", error);
        return res.status(500).json({ message: "Internal server error" });
    }
})

// Share a file with another user
router.post('/:id', async (req, res) => {
    const { email } = req.body

    try {
        if (!req.auth || !req.auth.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const sender = await userModel.findOne({ clerkId: req.auth.userId });
        if (!sender) {
            return res.status(404).json({ message: "Sender not found" });
        }

        const file = await fileModel.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: "File not found" });
        }

        const recipient = await userModel.findOne({ email });
        if (!recipient) {
            return res.status(404).json({ message: "Recipient not found" });
        }

        let sharedFile = await sharedFileModel.findOne({ fileId: file._id });

        if (!sharedFile) {
            sharedFile = await sharedFileModel.create({
                fileId: file._id,
                sharedBy: sender._id,
                sharedWithEmails: [recipient.email],
                sharedWithIds: [recipient.clerkId],
            })
        } else {
            if (!sharedFile.sharedWithEmails.includes(recipient.email)) {
                sharedFile.sharedWithEmails.push(recipient.email);
            }
            if (!sharedFile.sharedWithIds.includes(recipient.clerkId)) {
                sharedFile.sharedWithIds.push(recipient.clerkId);
            }
            await sharedFile.save();
        }
        
        if (!recipient.received.includes(file._id)) {
            recipient.received.push(file._id);
            await recipient.save();
        }

        res.status(200).json({ message: "File shared successfully", sharedFile });

    } catch (error) {
        console.error("error in sharing file", error);
        return res.status(500).json({ message: "Internal server error" });
    }
})

export default router;