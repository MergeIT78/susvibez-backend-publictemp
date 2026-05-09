import express from 'express';
import Coupon from '../models/Coupon.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// POST /api/coupons/validate  (public)
router.post('/validate', async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    const coupon = await Coupon.findOne({ code: code?.toUpperCase(), active: true });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return res.status(400).json({ message: 'Coupon has expired' });
    }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }
    if (orderTotal < coupon.minOrder) {
      return res.status(400).json({ message: `Minimum order of $${coupon.minOrder} required` });
    }
    const discount = coupon.type === 'percentage'
      ? (orderTotal * coupon.value) / 100
      : coupon.value;
    res.json({ valid: true, coupon, discount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/coupons/scratch  (public — generate a scratch card coupon)
router.get('/scratch', async (req, res) => {
  try {
    const prizes = [
      { code: null, label: 'Better luck next time!', type: 'none', value: 0 },
      { code: null, label: '5% OFF', type: 'percentage', value: 5 },
      { code: null, label: '10% OFF', type: 'percentage', value: 10 },
      { code: null, label: '$5 OFF', type: 'fixed', value: 5 },
      { code: null, label: '15% OFF', type: 'percentage', value: 15 },
    ];
    const weights = [30, 30, 20, 15, 5];
    const rand = Math.random() * 100;
    let sum = 0;
    let prize = prizes[0];
    for (let i = 0; i < prizes.length; i++) {
      sum += weights[i];
      if (rand < sum) { prize = prizes[i]; break; }
    }
    if (prize.type === 'none') {
      return res.json({ prize: prize.label, code: null });
    }
    // create a one-time coupon
    const code = 'SCRATCH' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const coupon = await Coupon.create({
      code,
      type: prize.type,
      value: prize.value,
      maxUses: 1,
      isScratchCard: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      description: `Scratch card: ${prize.label}`
    });
    res.json({ prize: prize.label, code: coupon.code });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/coupons  (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/coupons  (admin)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/coupons/:id  (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/coupons/:id  (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
