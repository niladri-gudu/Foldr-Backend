import express from "express";
import loginRoute from "./loginRoute.js";
import registerRoute from "./registerRoute.js";
import logoutRoute from "./logoutRoute.js";

const router = express.Router();

// Check user login status
router.get("/me", (req, res) => {
  const token = req.cookies.token
  if (!token) return res.json({ isLoggedIn: false })
    
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    res.json({ isLoggedIn: true, user })
  } catch {
    res.json({ isLoggedIn: false })
  }
})

// Define the /register route
router.use('/register', registerRoute)

// Define the /login route
router.use('/login', loginRoute);

// Define the /logout route
router.use('/logout', logoutRoute)

export default router;