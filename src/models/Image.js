import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  data:        { type: Buffer, required: true },
  contentType: { type: String, required: true },
  filename:    { type: String, default: '' },
  size:        { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Image', imageSchema);
