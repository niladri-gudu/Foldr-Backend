import express from 'express';
import userModel from '../../models/userModel.js';
import bcrypt from 'bcrypt';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await userModel.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await userModel.create({
            name,
            email,
            password: hashedPassword
        })

        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        console.error("Error in register route:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

export default router;