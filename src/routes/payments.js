import express from 'express';
import Stripe from 'stripe';

const router = express.Router();

// Lazy init — dotenv must run first before this is called
const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/payments/create-intent
// Creates a PaymentIntent and returns clientSecret to the frontend
router.post('/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', email, orderMeta } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: currency.toLowerCase(),
      receipt_email: email || undefined,
      metadata: {
        source: 'susvibez-website',
        ...(orderMeta || {})
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('Stripe create-intent error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

export default router;
