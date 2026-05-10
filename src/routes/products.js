import express from 'express';
import Product from '../models/Product.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { upload, cloudinary, extractPublicId } from '../middleware/upload.js';

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
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
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
    const { limit = 100, page = 1, search } = req.query;
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter)
    ]);
    res.json({ products, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

// DELETE /api/products/:id/images  (admin) — removes image URL + deletes from Cloudinary
router.delete('/:id/images', protect, adminOnly, async (req, res) => {
  try {
    const { url } = req.body;

    // Delete from Cloudinary (non-fatal if it fails)
    const publicId = extractPublicId(url);
    if (publicId) {
      try { await cloudinary.uploader.destroy(publicId); } catch (e) {
        console.warn('Cloudinary delete warn:', e.message);
      }
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

// POST /api/products/:id/upload  (admin) — upload to Cloudinary
router.post('/:id/upload', protect, adminOnly, upload.array('images', 10), async (req, res) => {
  try {
    // Cloudinary storage: req.files[n].path is the full Cloudinary URL
    const urls = req.files.map(f => f.path);
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
