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

  // Notifications
  notifyNewOrder: { type: Boolean, default: true },
  notifyOrderShipped: { type: Boolean, default: true },
  notifyLowStock: { type: Boolean, default: true },
  notifyNewUser: { type: Boolean, default: false },
  notifyCouponUsed: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
