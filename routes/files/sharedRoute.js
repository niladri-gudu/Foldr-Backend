import express from "express";
import fileModel from "../../models/fileModel.js";
import userModel from "../../models/userModel.js";
import sharedFileModel from "../../models/sharedFileModel.js";

const router = express.Router();

// Validating a user to share a file with
router.post('/validate', async (req, res) => {
    try {
        const { email } = req.body;
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const recipient = await userModel.findOne({ email });
        if (!recipient) {
            return res.status(404).json({ message: "User not found" });
        }


        const sender = await userModel.findById({ _id: req.user.userId });
        if (!sender) {
            return res.status(404).json({ message: "User not found" });
        }

        if (sender._id.equals(recipient._id)) {
            return res.status(400).json({ message: "You cannot share a file with yourself" });
        }

        res.status(200).json({ message: "User found", user: { email: recipient.email, _id: recipient._id, name: recipient.name } });

    } catch (error) {
        console.error("error in validating user", error);
        return res.status(500).json({ message: "Internal server error" });
    }
})

// Get all shared files for the logged in user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.user;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await userModel.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const sharedWithMe = await sharedFileModel.find({
            sharedWithIds: userId
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
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const sender = await userModel.findById({ _id: req.user.userId });
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
                sharedWithIds: [recipient._id],
            })
        } else {
            if (!sharedFile.sharedWithEmails.includes(recipient.email)) {
                sharedFile.sharedWithEmails.push(recipient.email);
            }
            if (!sharedFile.sharedWithIds.some(id => id.toString() === recipient._id.toString())) {
                sharedFile.sharedWithIds.push(recipient._id);
            }
            await sharedFile.save();
        }
        
        if (!sharedFile.sharedWithIds.some(id => id.toString() === recipient._id.toString())) {
            sharedFile.sharedWithIds.push(recipient._id);
        }

        res.status(200).json({ message: "File shared successfully", sharedFile });

    } catch (error) {
        console.error("error in sharing file", error);
        return res.status(500).json({ message: "Internal server error" });
    }
})

// Remove a file from the user's shared list
router.delete('/:fileId', async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { fileId } = req.params;
        const userId = req.user.userId;

        const sharedFile = await sharedFileModel.findOne({ fileId });
        if (!sharedFile) {
            return res.status(404).json({ message: "Shared file record not found" });
        }

        sharedFile.sharedWithIds = sharedFile.sharedWithIds.filter(
            id => id.toString() !== userId.toString()
        );
        sharedFile.sharedWithEmails = sharedFile.sharedWithEmails.filter(
            email => email !== req.user.email
        );

        await sharedFile.save();

        const user = await userModel.findById(userId);
        if (user) {
            user.received = user.received.filter(
                id => id.toString() !== fileId.toString()
            );
            await user.save();
        }

        res.status(200).json({ message: "File removed from shared list successfully" });
    } catch (error) {
        console.error("Error removing shared file:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});


export default router;