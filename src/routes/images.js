import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import Image from '../models/Image.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // accept up to 20MB raw, compress it down
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// Compress + resize: max 1400px wide, JPEG 82% — typically 100-300KB from any source
async function compress(buffer) {
  return sharp(buffer)
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

// POST /api/images  — upload + compress, store in MongoDB (admin)
router.post('/', protect, adminOnly, upload.array('images', 10), async (req, res) => {
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
    res.json({ urls });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/images/:id  — serve image, cached 1 year in browser
router.get('/:id', async (req, res) => {
  try {
    const img = await Image.findById(req.params.id).lean();
    if (!img) return res.status(404).send('Not found');

    res.set('Content-Type', img.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', String(img._id));
    res.send(img.data.buffer ?? img.data);
  } catch (err) {
    res.status(500).send('Error');
  }
});

// DELETE /api/images/:id  (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Image.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
