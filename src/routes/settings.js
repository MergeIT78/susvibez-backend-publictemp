import express from 'express';
import Settings from '../models/Settings.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

const FIELDS = [
  'storeName', 'storeEmail', 'defaultCurrency', 'taxRate', 'storeUrl', 'adminUrl',
  'freeShippingThreshold', 'standardShippingRate', 'expressShippingRate',
  'notifyNewOrder', 'notifyOrderShipped', 'notifyLowStock', 'notifyNewUser', 'notifyCouponUsed',
];

async function getOrCreate() {
  let s = await Settings.findOne({ key: 'store' });
  if (!s) s = await Settings.create({ key: 'store' });
  return s;
}

// GET /api/settings  (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    res.json(await getOrCreate());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings  (admin)
router.put('/', protect, adminOnly, async (req, res) => {
  try {
    const updates = {};
    FIELDS.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const s = await Settings.findOneAndUpdate(
      { key: 'store' },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
