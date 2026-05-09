import express from 'express';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users  (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments()
    ]);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id  (admin or self)
router.get('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user._id) !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await User.findById(req.params.id).select('-password').populate('orders');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id  (admin or self)
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user._id) !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const allowed = ['firstName', 'lastName', 'phone', 'country', 'preferredCurrency'];
    if (req.user.role === 'admin') allowed.push('role', 'email');
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/users/:id  (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
