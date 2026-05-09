/**
 * Run once to create the admin user and sample products:
 *   node src/seed.js
 */
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS — fix for SRV query issues
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

import User from './models/User.js';
import Product from './models/Product.js';
import Coupon from './models/Coupon.js';

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB');

// ── Admin user ──────────────────────────────────────────
const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
if (!existingAdmin) {
  await User.create({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    firstName: 'Admin',
    lastName: 'SusVibez',
    role: 'admin',
  });
  console.log(`✓ Admin created: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
} else {
  // Make sure existing user has admin role and correct password
  existingAdmin.role = 'admin';
  existingAdmin.password = process.env.ADMIN_PASSWORD;
  await existingAdmin.save();
  console.log(`✓ Admin updated to role=admin: ${process.env.ADMIN_EMAIL}`);
}

// ── Sample products ────────────────────────────────────
const productCount = await Product.countDocuments();
if (productCount === 0) {
  await Product.insertMany([
    {
      name: 'Midnight Drop Tee',
      slug: 'midnight-drop-tee',
      description: 'The flagship piece. 300GSM heavyweight cotton, oversized fit, screen-printed bold graphic. This is the one.',
      basePrice: 39.99,
      featured: true,
      images: [],
      variants: [
        { color: 'Black', colorHex: '#000000', sizes: [{ size: 'S', stock: 15 }, { size: 'M', stock: 20 }, { size: 'L', stock: 12 }, { size: 'XL', stock: 8 }, { size: 'XXL', stock: 5 }] },
        { color: 'White', colorHex: '#ffffff', sizes: [{ size: 'S', stock: 10 }, { size: 'M', stock: 18 }, { size: 'L', stock: 14 }, { size: 'XL', stock: 6 }] },
      ],
      tags: ['graphic', 'heavyweight', 'oversized', 'bestseller'],
      countryPricing: [
        { countryCode: 'AU', countryName: 'Australia', currency: 'USD', price: 44.99 },
        { countryCode: 'DE', countryName: 'Germany', currency: 'EUR', price: 37.99 },
      ],
      soldCount: 312,
      active: true,
    },
    {
      name: 'OG Crest Tee',
      slug: 'og-crest-tee',
      description: 'Clean logo tee with embroidered chest crest. Minimal. Premium. Timeless.',
      basePrice: 34.99,
      featured: true,
      images: [],
      variants: [
        { color: 'Black', colorHex: '#000000', sizes: [{ size: 'S', stock: 8 }, { size: 'M', stock: 15 }, { size: 'L', stock: 10 }] },
        { color: 'White', colorHex: '#ffffff', sizes: [{ size: 'S', stock: 6 }, { size: 'M', stock: 12 }, { size: 'L', stock: 9 }] },
        { color: 'Gray', colorHex: '#737373', sizes: [{ size: 'M', stock: 10 }, { size: 'L', stock: 7 }, { size: 'XL', stock: 4 }] },
      ],
      tags: ['logo', 'minimalist', 'crest'],
      countryPricing: [],
      soldCount: 198,
      active: true,
    },
    {
      name: 'Vibe Check Tee',
      slug: 'vibe-check-tee',
      description: 'Statement piece for those who need to know. Heavy cotton, bold back print, clean front.',
      basePrice: 35.99,
      featured: false,
      images: [],
      variants: [
        { color: 'Black', colorHex: '#000000', sizes: [{ size: 'S', stock: 5 }, { size: 'M', stock: 10 }, { size: 'L', stock: 8 }, { size: 'XL', stock: 3 }] },
      ],
      tags: ['statement', 'back-print', 'streetwear'],
      countryPricing: [],
      soldCount: 87,
      active: true,
    },
    {
      name: 'Shadow Line Tee',
      slug: 'shadow-line-tee',
      description: 'Subtle shadow gradient print on premium 300GSM. Limited first run.',
      basePrice: 44.99,
      featured: true,
      images: [],
      variants: [
        { color: 'Black', colorHex: '#000000', sizes: [{ size: 'S', stock: 3 }, { size: 'M', stock: 6 }, { size: 'L', stock: 4 }, { size: 'XL', stock: 2 }] },
        { color: 'Navy', colorHex: '#1e3a5f', sizes: [{ size: 'M', stock: 5 }, { size: 'L', stock: 3 }] },
      ],
      tags: ['limited', 'shadow', 'premium'],
      countryPricing: [
        { countryCode: 'AU', countryName: 'Australia', currency: 'USD', price: 49.99 },
      ],
      soldCount: 54,
      active: true,
    },
  ]);
  console.log('✓ Sample products created (4)');
} else {
  console.log(`✓ Products already exist (${productCount})`);
}

// ── Sample coupons ─────────────────────────────────────
const couponCount = await Coupon.countDocuments();
if (couponCount === 0) {
  await Coupon.insertMany([
    { code: 'VIBEZ10', type: 'percentage', value: 10, description: 'Welcome 10% off', active: true },
    { code: 'FLASH20', type: 'percentage', value: 20, description: 'Flash sale 20% off', active: true },
    { code: 'FREESHIP', type: 'fixed', value: 6.99, description: 'Free shipping code', active: true },
  ]);
  console.log('✓ Sample coupons created (3)');
} else {
  console.log(`✓ Coupons already exist (${couponCount})`);
}

await mongoose.disconnect();
console.log('\n🚀 Seed complete! You can now start the server.\n');
process.exit(0);
