import mongoose from 'mongoose';

// Global review LIBRARY — a shared pool you select from and attach to products.
const reviewLibrarySchema = new mongoose.Schema({
  author: { type: String, required: true },
  location: { type: String, default: '' },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  text: { type: String, default: '' },
  verified: { type: Boolean, default: true },
  date: { type: String, default: '' },          // kept as-is (e.g. "Jul 12, 2024")
  source: { type: String, default: 'manual' },   // 'etsy' | 'manual'
  originalItem: { type: String, default: '' },    // original Etsy product title (reference)
}, { timestamps: true });

export default mongoose.model('Review', reviewLibrarySchema);
