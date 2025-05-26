import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, require: true },
  password: { type: String, require: true },
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  deleted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  received: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
