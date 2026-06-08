import express from 'express';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reviews  (admin) — the library, with optional search
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { search, limit = 1000 } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { author: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } },
        { originalItem: { $regex: search, $options: 'i' } },
      ];
    }
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reviews  (admin) — add a review to the library
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    res.status(201).json(await Review.create(req.body));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/reviews/:id  (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    res.json(await Review.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/reviews/:id  (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reviews/attach  (admin) — copy selected library reviews onto products
// body: { reviewIds:[], toAll:true | productIds:[], mode:'append'|'replace' }
router.post('/attach', protect, adminOnly, async (req, res) => {
  try {
    const { reviewIds, productIds, toAll, mode = 'append' } = req.body;
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({ message: 'No reviews selected' });
    }
    if (!toAll && (!Array.isArray(productIds) || productIds.length === 0)) {
      return res.status(400).json({ message: 'No products selected' });
    }
    const lib = await Review.find({ _id: { $in: reviewIds } });
    const embed = lib.map(r => ({
      author: r.author, location: r.location, rating: r.rating,
      text: r.text, verified: r.verified, date: r.date,
    }));
    const filter = toAll ? {} : { _id: { $in: productIds } };
    const result = mode === 'replace'
      ? await Product.updateMany(filter, { $set: { reviews: embed } })
      : await Product.updateMany(filter, { $push: { reviews: { $each: embed } } });
    res.json({ products: result.modifiedCount, attached: embed.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
