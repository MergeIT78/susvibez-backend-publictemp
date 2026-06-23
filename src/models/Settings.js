import mongoose from 'mongoose';

// Single store-settings document (keyed 'store').
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'store', unique: true },

  // General
  storeName: { type: String, default: 'SusVibez' },
  storeEmail: { type: String, default: 'hello@susvibez.com' },
  defaultCurrency: { type: String, default: 'USD' },
  taxRate: { type: Number, default: 0 },
  storeUrl: { type: String, default: 'https://susvibez.com' },
  adminUrl: { type: String, default: 'https://admin.susvibez.com' },

  // Shipping
  freeShippingThreshold: { type: Number, default: 75 },
  standardShippingRate: { type: Number, default: 6.99 },
  expressShippingRate: { type: Number, default: 14.99 },

  // Homepage
  homepageBanner: { type: String, default: '' },             // image URL (/api/images/:id) shown after the last product row
  homepageReviewMode: { type: String, default: 'auto5' },    // 'auto5' = only 5-star reviews | 'manual' = featuredInCarousel reviews

  // Notifications
  notifyNewOrder: { type: Boolean, default: true },
  notifyOrderShipped: { type: Boolean, default: true },
  notifyLowStock: { type: Boolean, default: true },
  notifyNewUser: { type: Boolean, default: false },
  notifyCouponUsed: { type: Boolean, default: false },

  // Global product-page accordion text — edited once, shown on EVERY product page.
  // (Replaces the per-product `details` fields; served to the storefront via /settings/public.)
  productDefaults: {
    productDetails:   { type: String, default: '100% premium heavyweight cotton, 300GSM. Pre-shrunk, unisex fit. Ribbed collar. Double-needle sleeves and hem.' },
    sizeGuide:        { type: String, default: 'S: Chest 36-38" | M: Chest 38-40" | L: Chest 40-42" | XL: Chest 42-44" | XXL: Chest 44-46". We recommend sizing up for an oversized fit.' },
    shippingReturns:  { type: String, default: 'Ships within 2-3 business days. Free shipping on orders over $75. Easy 30-day returns for unworn items.' },
    careInstructions: { type: String, default: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat if needed.' },
    // Trust line shown right under the "Add to cart" button on every product page.
    shipNote:         { type: String, default: 'Ships from USA, Europe, Canada and Australia within 1–3 business days.' },
  },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
