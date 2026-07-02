import mongoose from 'mongoose';

const sizeStockSchema = new mongoose.Schema({
  size: { type: String, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  stock: { type: Number, default: 0 }
}, { _id: false });

const variantSchema = new mongoose.Schema({
  color: { type: String, required: true },
  colorHex: { type: String, default: '#000000' },
  sizes: [sizeStockSchema],
  images: [String]
}, { _id: true });

const countryPricingSchema = new mongoose.Schema({
  countryCode: { type: String, required: true }, // US, AU, GB, DE, etc.
  countryName: { type: String },
  currency: { type: String, default: 'USD' },
  price: { type: Number, required: true }
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  author: { type: String, required: true },
  location: { type: String, default: '' },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  text: { type: String, default: '' },
  verified: { type: Boolean, default: true },
  date: { type: String, default: '' } // kept as a string so Etsy dates (e.g. "Jul 12, 2024") survive
}, { _id: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  eyebrow: { type: String, default: '' }, // small label above product name (e.g. "Premium Graphic Tee")
  description: { type: String, default: '' },
  // Per-product accordion content shown on the product page (falls back to defaults on storefront)
  details: {
    productDetails: { type: String, default: '' },
    sizeGuide: { type: String, default: '' },
    shippingReturns: { type: String, default: '' },
    careInstructions: { type: String, default: '' },
  },
  reviews: [reviewSchema],
  basePrice: { type: Number, required: true }, // USD
  images: [String],
  variants: [variantSchema],
  category: { type: String, default: 'tshirt' },
  tags: [String],
  countryPricing: [countryPricingSchema],
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  onSale: { type: Boolean, default: false },
  salePrice: { type: Number, default: null },
  cardFocalX: { type: Number, default: 50 }, // 0-100 horizontal focal point %
  cardFocalY: { type: Number, default: 15 }, // 0-100 vertical focal point %
  cardZoom:   { type: Number, default: 1  }, // 1.0–2.5 zoom multiplier
  // Manual display order set by the admin. Lower = shown earlier. The default
  // sentinel (9999) means "no manual order" → those fall back to newest-first.
  // Separate orders per section so a product can be #1 in New Drops without being
  // #1 in Best Sellers. `sortOrder` is the general catalog/shop order.
  sortOrder: { type: Number, default: 9999 },
  featuredOrder: { type: Number, default: 9999 }, // Best Sellers / Featured section
  newDropOrder: { type: Number, default: 9999 },  // New Drops / New Arrivals section
  saleOrder: { type: Number, default: 9999 },     // On Sale listing
  soldCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 }
}, { timestamps: true, suppressReservedKeysWarning: true });

// Default storefront/admin listing: manual order first, then newest-first.
productSchema.index({ sortOrder: 1, createdAt: -1 });

productSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

export default mongoose.model('Product', productSchema);
