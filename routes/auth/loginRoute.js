import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../../models/userModel.js";

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: "User does not exist" });
        }

        bcrypt.compare(password, user.password, function (err, result) {
            if (err) {
                console.error("Error comparing passwords:", err);
                return res.status(500).json({ error: "Internal server error" });
            }
            if (!result) {
                return res.status(400).json({ message: "Invalid credentials" });
            }

            const token = jwt.sign(
                { userId: user._id, name: user.name, email: user.email },
                process.env.JWT_SECRET,
            );

            console.log(process.env.NODE_ENV === "production");

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 3600000,
            })
            
            res.status(200).json({ message: "Login successful" });
        })


    } catch (error) {
        console.error("Error in auth route:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
})

export default router;