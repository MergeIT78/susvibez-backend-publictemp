import multer from 'multer';

// Memory storage — files go straight to MongoDB, nothing written to disk
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// Stub exports so any existing import of cloudinary/extractPublicId doesn't crash
export const cloudinary      = null;
export const extractPublicId = () => null;
