import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/users.js';
import couponRoutes from './routes/coupons.js';
import currencyRoutes from './routes/currency.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import imageRoutes from './routes/images.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1); // behind Render/Cloudflare — needed for correct client IP (rate limit + geo)

// Security headers. CSP is disabled (this is a JSON API, not an HTML host) and
// CORP is cross-origin so the storefront can load /api/images from another origin.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — allowlist via ALLOWED_ORIGINS (comma-separated). If unset it stays open
// (so existing deploys keep working) but warns. Set it in production to lock down.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn('⚠️  ALLOWED_ORIGINS not set — CORS is open to all origins. Set it for production.');
  app.use(cors());
} else {
  app.use(cors({
    origin: (origin, cb) =>
      (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error('Not allowed by CORS')),
  }));
}

// Rate limiters (the Stripe webhook and image serving are intentionally NOT limited)
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts, try again later.' } });
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, try again later.' } });
const couponLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, try again later.' } });

// ⚠️  Webhook route MUST come BEFORE express.json() — Stripe needs raw body
app.use('/api/webhooks', webhookRoutes);

// JSON parsing for all other routes
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coupons', couponLimiter, couponRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/payments', paymentLimiter, paymentRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
      console.log(`Stripe webhook endpoint: POST /api/webhooks/stripe`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
