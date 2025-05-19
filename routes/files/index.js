import express from "express";
import uploadRoute from "./uploadRoute.js";
import starredRoute from "./starredRoute.js";
import trashRoute from "./trashRoute.js";
import sharedRoute from "./sharedRoute.js";
import restoreRoute from "./restoreRoute.js";
import viewRoute from "./viewRoute.js";
import deleteRoute from "./deleteRoute.js";

const router = express.Router();

router.use('/view', viewRoute)
router.use('/upload', uploadRoute);
router.use('/starred', starredRoute);
router.use('/trash', trashRoute);
router.use('/shared', sharedRoute);
router.use('/restore', restoreRoute);
router.use('/delete', deleteRoute);

export default router;