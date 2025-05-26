import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  size: { type: Number, required: true },
  starred: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  key: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.File || mongoose.model('File', FileSchema);
