import express from "express";
import fileModel from "../../models/fileModel.js";
import userModel from "../../models/userModel.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../utils/s3.js";

const router = express.Router();

// Permanently delete a file
router.delete("/:id", async (req, res) => {
    
    try {
        const fileId = req.params.id;
        const { userId } = req.user;

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

        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.key,
        })

        await s3.send(command)

        user.deleted.pull(fileId)
        await user.save()

        await fileModel.deleteOne({ _id: fileId });

        res.status(200).json({ message: "File deleted successfully" });

    } catch (error) {
        console.error("Error deleting file:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
})

export default router;