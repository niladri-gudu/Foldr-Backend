import mongoose from 'mongoose';

const SharedFileSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  sharedWithEmails: [{ type: String, required: true }], 
  sharedWithIds: [{ type: String, required: true }],
  sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.SharedFile || mongoose.model('SharedFile', SharedFileSchema);
