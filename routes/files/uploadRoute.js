import express from "express";
import upload from '../../utils/s3.js';
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";

const router = express.Router();

// Upload a file to S3 for the logged in user
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { userId } = req.user

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: missing userId" });
        }

        const user = await userModel.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const file = req.file;

        const newFile = await fileModel.create({
            userId: user._id,
            name: file.originalname,
            email: user.email,
            size: file.size,
            starred: false,
            key: file.key,
            url: file.location,
            type: file.mimetype,
        })

        user.files.push(newFile._id);
        await user.save();

        res.status(200).json({
            message: "File uploaded successfully",
            file: {
                id: newFile._id,
                name: newFile.name,
                size: newFile.size,
                url: newFile.url,
                type: newFile.type,
            },
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed' });
    }
})

export default router;