import express from "express";
import loginRoute from "./loginRoute.js";

const router = express.Router();

router.use('/login', loginRoute);

export default router;