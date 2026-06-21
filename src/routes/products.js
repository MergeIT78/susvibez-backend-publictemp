import express from 'express';
import sharp from 'sharp';
import Product from '../models/Product.js';
import Image from '../models/Image.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

async function compress(buffer) {
  return sharp(buffer)
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

const router = express.Router();

// GET /api/products/categories  (public — distinct categories)
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { active: true });
    res.json(categories.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products  (public)
router.get('/', async (req, res) => {
  try {
    const { featured, limit = 50, page = 1, search, category, new: isNew, sale } = req.query;
    const filter = { active: true };
    if (featured === 'true') filter.featured = true;
    if (isNew === 'true') filter.isNew = true;
    if (sale === 'true') filter.onSale = true;
    if (category) filter.category = { $regex: `^${category}$`, $options: 'i' };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      // Manual admin order first (sortOrder asc), then newest-first. The `_id`
      // tiebreaker keeps it deterministic when products share a createdAt.
      Product.find(filter).sort({ sortOrder: 1, createdAt: -1, _id: -1 }).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter)
    ]);
    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/admin — all products for admin (protected)
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { limit, page = 1, search } = req.query;
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    // Pagination is OPTIONAL. With no `limit`, the admin gets the FULL catalog.
    // (Previously defaulted to 100, which silently hid the newest products once
    // the catalog grew past 100 — the storefront fetched 200 and showed more.)
    let q = Product.find(filter).sort({ sortOrder: 1, createdAt: -1, _id: -1 });
    if (limit) {
      const lim = Number(limit);
      q = q.skip((Number(page) - 1) * lim).limit(lim);
    }
    const [products, total] = await Promise.all([q, Product.countDocuments(filter)]);
    res.json({ products, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/products/bulk  (admin) — bulk update or delete selected products
// Defined before /:id so the literal "bulk" path is unambiguous.
router.patch('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { ids, action, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No products selected' });
    }
    if (action === 'delete') {
      const r = await Product.deleteMany({ _id: { $in: ids } });
      return res.json({ deleted: r.deletedCount });
    }
    const ALLOWED = ['active', 'featured', 'isNew', 'onSale', 'salePrice', 'category', 'basePrice'];
    const set = {};
    ALLOWED.forEach(k => { if (updates?.[k] !== undefined) set[k] = updates[k]; });
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ message: 'No changes provided' });
    }
    const r = await Product.updateMany({ _id: { $in: ids } }, { $set: set });
    res.json({ matched: r.matchedCount, modified: r.modifiedCount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/products/:id  (public — by id or slug)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({
      $or: [{ _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }, { slug: req.params.id }]
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    // increment view count
    await Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products  (admin)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/products/:id  (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/products/:id  (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/products/:id/images  (admin) — removes image URL + deletes from MongoDB
router.delete('/:id/images', protect, adminOnly, async (req, res) => {
  try {
    const { url } = req.body;

    // Extract Image _id from /api/images/:id and delete from MongoDB
    const match = url && url.match(/\/api\/images\/([a-f\d]{24})$/i);
    if (match) {
      try { await Image.findByIdAndDelete(match[1]); } catch (e) {}
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $pull: { images: url } },
      { new: true }
    );
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products/:id/upload  (admin) — save to MongoDB, store /api/images/:id URL
router.post('/:id/upload', protect, adminOnly, upload.array('images', 10), async (req, res) => {
  try {
    const saved = await Promise.all(
      req.files.map(async f => {
        const compressed = await compress(f.buffer);
        return Image.create({
          data:        compressed,
          contentType: 'image/jpeg',
          filename:    f.originalname,
          size:        compressed.length,
        });
      })
    );
    const urls = saved.map(img => `/api/images/${img._id}`);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $push: { images: { $each: urls } } },
      { new: true }
    );
    res.json({ urls, product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
