import express from "express";
import multer from 'multer';
import AWS from 'aws-sdk';
import userModel from "../../models/userModel.js";
import fileModel from "../../models/fileModel.js";
import fs from 'fs';

const router = express.Router();
const upload = multer({ dest: 'temp/' });

console.log('✅ Chunked upload route loaded');

// Configure AWS S3 (make sure these env vars are set)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Store active uploads in memory
const activeUploads = new Map();

// 1. Initiate multipart upload
router.post('/initiate-upload', async (req, res) => {
  console.log('📤 Initiate upload route hit:', req.body);
  
  try {
    const { userId } = req.user;
    const { fileName, fileSize, totalChunks } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`👤 User: ${userId}, File: ${fileName}, Size: ${fileSize}`);

    // Create multipart upload on S3
    const key = `${userId}/${Date.now()}-${fileName}`;
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: req.body.contentType || 'application/octet-stream'
    };

    console.log('🪣 Creating S3 multipart upload...');
    const multipartUpload = await s3.createMultipartUpload(params).promise();
    
    // Store upload info
    activeUploads.set(multipartUpload.UploadId, {
      userId,
      fileName,
      fileSize,
      totalChunks,
      key,
      parts: [],
      uploadedChunks: new Set()
    });

    console.log(`✅ Upload initiated with ID: ${multipartUpload.UploadId}`);
    res.json({ uploadId: multipartUpload.UploadId });
  } catch (error) {
    console.error('❌ Initiate upload error:', error);
    res.status(500).json({ error: 'Failed to initiate upload: ' + error.message });
  }
});

// 2. Upload individual chunk
router.post('/upload-chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const chunkFile = req.file;
    
    console.log(`📦 Uploading chunk ${chunkIndex} for upload ${uploadId}`);
    
    if (!activeUploads.has(uploadId)) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }

    const uploadInfo = activeUploads.get(uploadId);
    const chunkNum = parseInt(chunkIndex) + 1; // S3 parts are 1-indexed

    // Upload chunk to S3
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uploadInfo.key,
      PartNumber: chunkNum,
      UploadId: uploadId,
      Body: fs.createReadStream(chunkFile.path)
    };

    const result = await s3.uploadPart(params).promise();
    
    // Store part info
    uploadInfo.parts[parseInt(chunkIndex)] = {
      ETag: result.ETag,
      PartNumber: chunkNum
    };
    uploadInfo.uploadedChunks.add(parseInt(chunkIndex));

    // Clean up temp file
    fs.unlinkSync(chunkFile.path);

    console.log(`✅ Chunk ${chunkIndex} uploaded successfully`);
    res.json({ 
      success: true, 
      chunkIndex: parseInt(chunkIndex),
      etag: result.ETag 
    });
  } catch (error) {
    console.error('❌ Chunk upload error:', error);
    res.status(500).json({ error: 'Failed to upload chunk: ' + error.message });
  }
});

// 3. Complete multipart upload
router.post('/complete-upload', async (req, res) => {
  try {
    const { uploadId, fileName } = req.body;
    
    console.log(`🏁 Completing upload ${uploadId}`);
    
    if (!activeUploads.has(uploadId)) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }

    const uploadInfo = activeUploads.get(uploadId);
    
    // Prepare parts array for S3 (filter out empty slots and sort)
    const parts = uploadInfo.parts
      .filter(part => part) // Remove empty slots
      .sort((a, b) => a.PartNumber - b.PartNumber);

    console.log(`📋 Completing with ${parts.length} parts`);

    // Complete multipart upload on S3
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uploadInfo.key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    };

    const result = await s3.completeMultipartUpload(params).promise();
    
    // Save file info to database
    const user = await userModel.findById(uploadInfo.userId);
    if (!user) {
      throw new Error('User not found');
    }

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

    // Clean up
    activeUploads.delete(uploadId);

    console.log('✅ Upload completed successfully');
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
    console.error('❌ Complete upload error:', error);
    res.status(500).json({ error: 'Failed to complete upload: ' + error.message });
  }
});

// 4. Cancel upload
router.post('/cancel-upload', async (req, res) => {
  try {
    const { uploadId } = req.body;
    
    console.log(`🛑 Cancelling upload ${uploadId}`);
    
    if (activeUploads.has(uploadId)) {
      const uploadInfo = activeUploads.get(uploadId);
      
      // Abort multipart upload on S3
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: uploadInfo.key,
        UploadId: uploadId
      };

      await s3.abortMultipartUpload(params).promise();
      activeUploads.delete(uploadId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Cancel upload error:', error);
    res.status(500).json({ error: 'Failed to cancel upload: ' + error.message });
  }
});

export default router;