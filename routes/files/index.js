import express from "express";
import uploadRoute from "./uploadRoute.js";
import chunkedUploadRoute from "./chunkedUploadRoute.js";
import starredRoute from "./starredRoute.js";
import trashRoute from "./trashRoute.js";
import sharedRoute from "./sharedRoute.js";
import restoreRoute from "./restoreRoute.js";
import viewRoute from "./viewRoute.js";
import deleteRoute from "./deleteRoute.js";
import downloadRoute from './downloadRoute.js'

const router = express.Router();

// Debug middleware to log all routes
router.use((req, res, next) => {
  console.log(`📁 File route: ${req.method} ${req.originalUrl}`);
  next();
});

router.use('/view', viewRoute);
router.use('/upload', uploadRoute);

// Mount chunked upload routes directly on the router
router.use('/', chunkedUploadRoute);

router.use('/starred', starredRoute);
router.use('/trash', trashRoute);
router.use('/shared', sharedRoute);
router.use('/restore', restoreRoute);
router.use('/delete', deleteRoute);
router.use('/download', downloadRoute)

export default router;