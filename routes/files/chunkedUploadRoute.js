import express from "express";
import multer from 'multer';
import AWS from 'aws-sdk';
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";
import { redis } from "../../lib/redis.js";

const router = express.Router();

// Use memory storage instead of writing to disk
const upload = multer({ storage: multer.memoryStorage() });

console.log('✅ Chunked upload route loaded');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// 1. Initiate multipart upload
router.post('/initiate-upload', async (req, res) => {
  try {
    const { userId } = req.user;
    const { fileName, fileSize, totalChunks } = req.body;

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

    // Save upload state to Redis
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

    res.json({ uploadId: multipartUpload.UploadId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate upload: ' + error.message });
  }
});

// 2. Upload individual chunk (now from memory)
router.post('/upload-chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const chunkFile = req.file;

    if (!chunkFile || !chunkFile.buffer) {
      return res.status(400).json({ error: 'Chunk file missing' });
    }

    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (!uploadInfoRaw) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }

    const uploadInfo = JSON.parse(uploadInfoRaw);
    const chunkNum = parseInt(chunkIndex, 10) + 1;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uploadInfo.key,
      PartNumber: chunkNum,
      UploadId: uploadId,
      Body: chunkFile.buffer
    };

    const result = await s3.uploadPart(params).promise();

    uploadInfo.parts[parseInt(chunkIndex, 10)] = {
      ETag: result.ETag,
      PartNumber: chunkNum
    };
    uploadInfo.uploadedChunks.push(parseInt(chunkIndex, 10));

    // Save back to Redis
    await redis.set(
      `upload:${uploadId}`,
      JSON.stringify(uploadInfo),
      'EX',
      60 * 60
    );

    res.json({ 
      success: true, 
      chunkIndex: parseInt(chunkIndex, 10),
      etag: result.ETag 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload chunk: ' + error.message });
  }
});

// 3. Complete multipart upload
router.post('/complete-upload', async (req, res) => {
  try {
    const { uploadId, fileName } = req.body;

    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (!uploadInfoRaw) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }
    const uploadInfo = JSON.parse(uploadInfoRaw);

    const parts = uploadInfo.parts
      .filter(Boolean)
      .sort((a, b) => a.PartNumber - b.PartNumber);

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uploadInfo.key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    };

    const result = await s3.completeMultipartUpload(params).promise();

    const user = await userModel.findById(uploadInfo.userId);
    if (!user) throw new Error('User not found');

    const newFile = await fileModel.create({
      userId: uploadInfo.userId,
      name: fileName,
      email: user.email,
      size: uploadInfo.fileSize,
      starred: false,
      key: uploadInfo.key,
      url: result.Location,
      type: 'application/octet-stream',
    });

    user.files.push(newFile._id);
    await user.save();

    // Remove from Redis
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
    res.status(500).json({ error: 'Failed to complete upload: ' + error.message });
  }
});

// 4. Cancel upload
router.post('/cancel-upload', async (req, res) => {
  try {
    const { uploadId } = req.body;
    const uploadInfoRaw = await redis.get(`upload:${uploadId}`);
    if (uploadInfoRaw) {
      const uploadInfo = JSON.parse(uploadInfoRaw);

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: uploadInfo.key,
        UploadId: uploadId
      };

      await s3.abortMultipartUpload(params).promise();
      await redis.del(`upload:${uploadId}`);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel upload: ' + error.message });
  }
});

export default router;
