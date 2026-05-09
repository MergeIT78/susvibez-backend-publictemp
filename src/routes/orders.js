import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// POST /api/orders  (public — place order)
router.post('/', async (req, res) => {
  try {
    const { items, shippingAddress, couponCode, currency, guestEmail, userId } = req.body;

    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
      if (coupon) {
        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        if (coupon.type === 'percentage') discount = (subtotal * coupon.value) / 100;
        else discount = coupon.value;
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
      }
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = Math.max(0, subtotal - discount);

    const order = await Order.create({
      items,
      shippingAddress,
      couponCode: couponCode || '',
      currency: currency || 'USD',
      guestEmail: guestEmail || '',
      user: userId || null,
      subtotal,
      discount,
      total
    });

    // update sold count
    for (const item of items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, { $inc: { soldCount: item.quantity } });
      }
    }

    // attach to user
    if (userId) {
      await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/orders  (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { limit = 50, page = 1, status } = req.query;
    const filter = {};
    if (status) filter.fulfillmentStatus = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('user', 'email firstName lastName'),
      Order.countDocuments(filter)
    ]);
    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/my  (authenticated user)
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/:id  (admin or owner)
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'email firstName lastName');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.role !== 'admin' && String(order.user?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id  (admin — update status)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/orders/stats/overview  (admin)
router.get('/stats/overview', protect, adminOnly, async (req, res) => {
  try {
    const [totalOrders, revenue, pending] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ fulfillmentStatus: 'unfulfilled' })
    ]);
    res.json({
      totalOrders,
      revenue: revenue[0]?.total || 0,
      pendingOrders: pending
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
