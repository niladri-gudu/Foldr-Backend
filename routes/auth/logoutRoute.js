import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: "Logout successful" });
})

export default router;