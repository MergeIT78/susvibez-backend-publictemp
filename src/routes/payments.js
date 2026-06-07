import express from 'express';
import { getStripe } from '../services/stripe.js';
import { priceOrder } from '../services/pricing.js';

const router = express.Router();

// POST /api/payments/create-intent
// The amount is computed SERVER-SIDE from the cart items + coupon — the client
// can no longer dictate how much it pays. Returns clientSecret + the authoritative total.
router.post('/create-intent', async (req, res) => {
  try {
    const { items, couponCode, country, currency, email } = req.body;

    const priced = await priceOrder({ items, couponCode, country, currency });
    if (priced.total <= 0) {
      return res.status(400).json({ message: 'Invalid order total' });
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(priced.total * 100), // Stripe uses minor units
      currency: priced.currency.toLowerCase(),
      receipt_email: email || undefined,
      metadata: { source: 'susvibez-website' },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: priced.total,        // authoritative — show this to the customer
      currency: priced.currency,
    });
  } catch (err) {
    console.error('Stripe create-intent error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

export default router;
