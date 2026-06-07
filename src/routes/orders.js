import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { sendShippingConfirmation } from '../services/email.js';
import { getStripe } from '../services/stripe.js';
import { priceOrder } from '../services/pricing.js';
import { sendConfirmationOnce } from '../services/orderEmail.js';

const router = express.Router();

// POST /api/orders  (public — place order)
// Prices/totals are recomputed server-side and the payment is verified with
// Stripe before the order is ever marked "paid". Client-sent prices/status are ignored.
router.post('/', async (req, res) => {
  try {
    const {
      items, shippingAddress, couponCode, currency, country,
      guestEmail, userId, stripePaymentIntentId,
    } = req.body;

    // 1. Recompute pricing from the database. Stock was already validated at
    //    create-intent (pre-charge); don't reject a paid order on a stock race —
    //    decrement below may go negative and is reconciled in the admin.
    const priced = await priceOrder({ items, couponCode, country, currency, checkStock: false });

    // 2. Verify the payment with Stripe before trusting "paid"
    let paymentStatus = 'pending';
    let stripeReceiptUrl = '';
    if (stripePaymentIntentId) {
      const pi = await getStripe().paymentIntents.retrieve(stripePaymentIntentId);
      const expected = Math.round(priced.total * 100);
      const ok = pi
        && pi.status === 'succeeded'
        && pi.currency === priced.currency.toLowerCase()
        && (pi.amount_received ?? pi.amount) >= expected;
      if (!ok) return res.status(400).json({ message: 'Payment could not be verified' });
      paymentStatus = 'paid';
      try {
        if (pi.latest_charge) {
          const ch = await getStripe().charges.retrieve(pi.latest_charge);
          stripeReceiptUrl = ch.receipt_url || '';
        }
      } catch { /* receipt is best-effort */ }
    }

    // 3. Create the order from server-computed values
    const order = await Order.create({
      items: priced.lineItems,
      shippingAddress,
      couponCode: priced.coupon ? priced.coupon.code : '',
      currency: priced.currency,
      guestEmail: guestEmail || '',
      user: userId || null,
      subtotal: priced.subtotal,
      discount: priced.discount,
      total: priced.total,
      stripePaymentIntentId: stripePaymentIntentId || '',
      stripeReceiptUrl,
      paymentStatus,
      fulfillmentStatus: paymentStatus === 'paid' ? 'processing' : 'unfulfilled',
    });

    // 4. Coupon usage (only if actually applied)
    if (priced.coupon) {
      await Coupon.findByIdAndUpdate(priced.coupon._id, { $inc: { usedCount: 1 } });
    }

    // 5. Decrement stock + bump soldCount atomically per line item
    for (const li of priced.lineItems) {
      await Product.updateOne(
        { _id: li.product },
        { $inc: { soldCount: li.quantity, 'variants.$[v].sizes.$[s].stock': -li.quantity } },
        { arrayFilters: [{ 'v.color': li.color }, { 's.size': li.size }] }
      ).catch(() => {/* variant/size mismatch — soldCount path is best-effort */});
    }

    // 6. Attach to the user's account
    if (userId) await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });

    // 7. One confirmation email (deduped against the Stripe webhook)
    if (paymentStatus === 'paid') {
      await sendConfirmationOnce(order._id, { receiptUrl: stripeReceiptUrl });
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

// POST /api/orders/:id/fulfill  (admin — ship order + send AWB email)
router.post('/:id/fulfill', protect, adminOnly, async (req, res) => {
  try {
    const { trackingNumber, trackingCarrier, adminNotes } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        trackingNumber: trackingNumber || '',
        trackingCarrier: trackingCarrier || '',
        adminNotes: adminNotes || '',
        fulfillmentStatus: 'shipped',
        shippedAt: new Date(),
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Send shipping email
    try {
      const addr = order.shippingAddress || {};
      const customerEmail = addr.email || order.guestEmail;
      const customerName = [addr.firstName, addr.lastName].filter(Boolean).join(' ');
      const shippingAddress = addr.address ? {
        line1: addr.address,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        country: addr.country,
      } : null;

      if (customerEmail) {
        await sendShippingConfirmation({
          customerEmail,
          customerName,
          orderNumber: order.orderNumber,
          items: order.items,
          totalAmount: order.total,
          currency: order.currency,
          shippingAddress,
          trackingNumber,
          trackingCarrier,
          adminNotes,
        });
      }
    } catch (emailErr) {
      console.error('📧 Shipping email failed (non-fatal):', emailErr.message);
    }

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

// GET /api/orders/stats/dashboard  (admin) — real metrics (no fabricated numbers)
router.get('/stats/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, paidAgg, monthlyAgg, countryAgg, topProduct, totalCustomers, perUser] =
      await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ fulfillmentStatus: 'unfulfilled' }),
        Order.aggregate([
          { $match: { paymentStatus: 'paid' } },
          { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: { paymentStatus: 'paid', createdAt: { $gte: start } } },
          { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, revenue: { $sum: '$total' } } },
        ]),
        Order.aggregate([
          { $match: { 'shippingAddress.country': { $nin: [null, ''] } } },
          { $group: { _id: '$shippingAddress.country', count: { $sum: 1 } } },
          { $sort: { count: -1 } }, { $limit: 1 },
        ]),
        Product.findOne().sort({ soldCount: -1 }).select('name soldCount'),
        User.countDocuments({ role: 'customer' }),
        Order.aggregate([
          { $match: { user: { $ne: null } } },
          { $group: { _id: '$user', n: { $sum: 1 } } },
        ]),
      ]);

    const revenue = paidAgg[0]?.revenue || 0;
    const paidOrders = paidAgg[0]?.count || 0;

    // Continuous 12-month revenue series (fill gaps with 0)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const series = [];
    const cursor = new Date(start);
    for (let i = 0; i < 12; i++) {
      const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
      const hit = monthlyAgg.find(a => a._id.y === y && a._id.m === m);
      series.push({ label: months[m - 1], revenue: Math.round(hit?.revenue || 0) });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const returningCount = perUser.filter(u => u.n > 1).length;
    const returningRate = perUser.length ? Math.round((returningCount / perUser.length) * 100) : 0;

    res.json({
      totalOrders,
      pendingOrders,
      revenue,
      paidOrders,
      avgOrderValue: paidOrders ? +(revenue / paidOrders).toFixed(2) : 0,
      monthly: series,
      topCountry: countryAgg[0] ? { country: countryAgg[0]._id, count: countryAgg[0].count } : null,
      topProduct: topProduct ? { name: topProduct.name, soldCount: topProduct.soldCount } : null,
      totalCustomers,
      returningRate,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
