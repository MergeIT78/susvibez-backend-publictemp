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

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, default: '' },
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
  soldCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 }
}, { timestamps: true, suppressReservedKeysWarning: true });

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
