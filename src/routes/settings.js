import express from 'express';
import Settings from '../models/Settings.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

const FIELDS = [
  'storeName', 'storeEmail', 'defaultCurrency', 'taxRate', 'storeUrl', 'adminUrl',
  'freeShippingThreshold', 'standardShippingRate', 'expressShippingRate',
  'heroImage', 'homepageBanner', 'featuredImage1', 'featuredImage2', 'homepageReviewMode',
  'notifyNewOrder', 'notifyOrderShipped', 'notifyLowStock', 'notifyNewUser', 'notifyCouponUsed',
];

const CONTENT_KEYS = ['productDetails', 'sizeGuide', 'shippingReturns', 'careInstructions', 'shipNote'];

async function getOrCreate() {
  let s = await Settings.findOne({ key: 'store' });
  if (!s) s = await Settings.create({ key: 'store' });
  return s;
}

// GET /api/settings/public  (PUBLIC) — storefront-safe subset only.
// Never expose notification flags / internal config here.
router.get('/public', async (req, res) => {
  try {
    const s = await getOrCreate();
    res.json({
      storeName: s.storeName,
      productDefaults: s.productDefaults,
      heroImage: s.heroImage,
      homepageBanner: s.homepageBanner,
      featuredImage1: s.featuredImage1,
      featuredImage2: s.featuredImage2,
      homepageReviewMode: s.homepageReviewMode,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
    // Global product-page text — merge per field via dot-paths so a partial
    // update never wipes the other fields.
    const pd = req.body.productDefaults;
    if (pd && typeof pd === 'object') {
      CONTENT_KEYS.forEach(k => { if (pd[k] !== undefined) updates[`productDefaults.${k}`] = String(pd[k]); });
    }
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
