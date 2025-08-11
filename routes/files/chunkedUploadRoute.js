import express from "express";
import multer from 'multer';
import AWS from 'aws-sdk';
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";
import { redis } from "../../lib/redis.js";

const router = express.Router();

console.log('✅ Chunked upload route loaded');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: "v4",
});

// 1. Initiate multipart upload
router.post('/initiate-upload', async (req, res) => {
  try {
    const { userId } = req.user;
    const { fileName, fileSize, totalChunks, contentType } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const key = `${userId}/${Date.now()}-${fileName}`;
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: req.body.contentType || 'application/octet-stream'
    };

    const multipartUpload = await s3.createMultipartUpload(params).promise();

    await redis.set(
      `upload:${multipartUpload.UploadId}`,
      JSON.stringify({
        userId,
        fileName,
        fileSize,
        totalChunks,
        key,
        parts: [],
        uploadedChunks: []
      }),
      'EX',
      60 * 60
    );

    res.json({ uploadId: multipartUpload.UploadId, key });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate upload: ' + error.message });
  }
});

// 2. Get presigned URL for a chunk
router.post("/get-upload-url", async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;

    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (!uploadInfoRaw) {
      return res.status(400).json({ error: "Invalid upload ID" });
    }

    const uploadInfo = JSON.parse(uploadInfoRaw);
    const partNumber = parseInt(chunkIndex, 10) + 1;

    const url = await s3.getSignedUrlPromise("uploadPart", {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uploadInfo.key,
      PartNumber: partNumber,
      UploadId: uploadId,
      Expires: 3600,
    });

    res.json({ url, partNumber });
  } catch (error) {
    res.status(500).json({ error: "Failed to get upload URL: " + error.message });
  }
});

// 3. Mark chunk as uploaded (client sends ETag after S3 upload)
router.post("/mark-chunk-uploaded", async (req, res) => {
  try {
    const { uploadId, chunkIndex, etag } = req.body;

    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (!uploadInfoRaw) {
      return res.status(400).json({ error: "Invalid upload ID" });
    }

    const uploadInfo = JSON.parse(uploadInfoRaw);
    const partNumber = parseInt(chunkIndex, 10) + 1;

    uploadInfo.parts[chunkIndex] = {
      ETag: etag,
      PartNumber: partNumber,
    };
    uploadInfo.uploadedChunks.push(chunkIndex);

    await redis.set(
      `upload:${uploadId}`,
      JSON.stringify(uploadInfo),
      "EX",
      60 * 60
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark chunk uploaded: " + error.message });
  }
});

// 4. Complete multipart upload
router.post("/complete-upload", async (req, res) => {
  try {
    const { uploadId, fileName } = req.body;

    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (!uploadInfoRaw) {
      return res.status(400).json({ error: "Invalid upload ID" });
    }
    const uploadInfo = JSON.parse(uploadInfoRaw);

    const parts = uploadInfo.parts
      .filter(Boolean)
      .sort((a, b) => a.PartNumber - b.PartNumber);

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uploadInfo.key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    };

    const result = await s3.completeMultipartUpload(params).promise();

    const user = await userModel.findById(uploadInfo.userId);
    if (!user) throw new Error("User not found");

    const newFile = await fileModel.create({
      userId: uploadInfo.userId,
      name: fileName,
      email: user.email,
      size: uploadInfo.fileSize,
      starred: false,
      key: uploadInfo.key,
      url: result.Location,
      type: "application/octet-stream",
    });

    user.files.push(newFile._id);
    await user.save();

    await redis.del(`upload:${uploadId}`);

    res.json({
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
    res.status(500).json({ error: "Failed to complete upload: " + error.message });
  }
});

// 5. Cancel upload
router.post("/cancel-upload", async (req, res) => {
  try {
    const { uploadId } = req.body;
    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (uploadInfoRaw) {
      const uploadInfo = JSON.parse(uploadInfoRaw);

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: uploadInfo.key,
        UploadId: uploadId,
      };

      await s3.abortMultipartUpload(params).promise();
      await redis.del(`upload:${uploadId}`);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel upload: " + error.message });
  }
});

export default router;