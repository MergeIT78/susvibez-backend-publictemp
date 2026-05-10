import express from 'express';
import multer from 'multer';
import Image from '../models/Image.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Memory storage — no disk writes, buffer goes straight to MongoDB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// POST /api/images  — upload one or many (admin)
router.post('/', protect, adminOnly, upload.array('images', 10), async (req, res) => {
  try {
    const saved = await Promise.all(
      req.files.map(f =>
        Image.create({
          data:        f.buffer,
          contentType: f.mimetype,
          filename:    f.originalname,
          size:        f.size,
        })
      )
    );
    // Return relative paths — imgUrl() in frontend will prepend SERVER_BASE
    const urls = saved.map(img => `/api/images/${img._id}`);
    res.json({ urls });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/images/:id  — serve image (public, cached 1 year)
router.get('/:id', async (req, res) => {
  try {
    const img = await Image.findById(req.params.id).lean();
    if (!img) return res.status(404).send('Not found');

    res.set('Content-Type', img.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', String(img._id));
    res.send(img.data.buffer ?? img.data);
  } catch (err) {
    res.status(500).send('Error');
  }
});

// DELETE /api/images/:id  — remove from MongoDB (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Image.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
