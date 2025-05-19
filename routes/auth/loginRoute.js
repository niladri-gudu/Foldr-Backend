import express from "express";
import userModel from "../../models/userModel.js";
import { clerkClient } from "@clerk/express";

const router = express.Router();

// Login route for the logged in user
// This route is used to log in a user using Clerk authentication
// It retrieves the user's information from Clerk and creates a new user in the database if they don't exist
router.post('/', async (req, res) => {
    try {
        const { userId } = req.auth
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: missing userId" });
        }

        const user = await clerkClient.users.getUser(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const email = user.emailAddresses?.[0]?.emailAddress || '';
        const { firstName, lastName, id: clerkId } = user;
        const name = `${firstName || ''} ${lastName || ''}`.trim();
        
        let existingUser = await userModel.findOne({ clerkId });

        if (!existingUser) {
            existingUser = await userModel.create({
                clerkId,
                email,
                name,
            });
            console.log('New user created:', existingUser);
        }

        res.status(200).json({ message: 'User logged in successfully', user: existingUser });

    } catch (error) {
        console.error("Error in auth route:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
})

export default router;