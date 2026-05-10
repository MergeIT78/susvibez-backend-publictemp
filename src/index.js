import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS — open to all origins (auth via JWT header, not cookies)
app.use(cors());

// ⚠️  Webhook route MUST come BEFORE express.json() — Stripe needs raw body
app.use('/api/webhooks', webhookRoutes);

// JSON parsing for all other routes
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/payments', paymentRoutes);

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
