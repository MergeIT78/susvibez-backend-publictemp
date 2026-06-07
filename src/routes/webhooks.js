import express from 'express';
import Order from '../models/Order.js';
import { getStripe } from '../services/stripe.js';
import { sendConfirmationOnce } from '../services/orderEmail.js';

const router = express.Router();

// POST /api/webhooks/stripe
// Stripe sends raw body — must be registered BEFORE express.json() middleware
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log('✅ Payment succeeded:', pi.id, '→', pi.amount / 100, pi.currency.toUpperCase());

        // Fetch Stripe receipt URL from charge
        let stripeReceiptUrl = '';
        try {
          if (pi.latest_charge) {
            const charge = await getStripe().charges.retrieve(pi.latest_charge);
            stripeReceiptUrl = charge.receipt_url || '';
          }
        } catch (chargeErr) {
          console.warn('Could not fetch Stripe charge:', chargeErr.message);
        }

        // Update order: mark as paid, move to processing
        const updated = await Order.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          {
            paymentStatus: 'paid',
            fulfillmentStatus: 'processing',
            stripeReceiptUrl,
          },
          { new: true }
        );

        if (!updated) {
          // Order may not exist yet (webhook beat the order-create call) — the
          // order route verifies the PI itself and will send the email then.
          console.warn('⚠️  Order not found for PaymentIntent:', pi.id);
        } else {
          console.log('📦 Order updated:', updated.orderNumber);
          // Deduped: sends only if the order route hasn't already emailed
          await sendConfirmationOnce(updated._id, { receiptUrl: stripeReceiptUrl });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.log('❌ Payment failed:', pi.id);
        await Order.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { paymentStatus: 'failed' }
        );
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.payment_intent) {
          await Order.findOneAndUpdate(
            { stripePaymentIntentId: charge.payment_intent },
            { paymentStatus: 'refunded', fulfillmentStatus: 'cancelled' }
          );
        }
        break;
      }

      default:
        // Unhandled event — ignore
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    // Still return 200 so Stripe doesn't retry endlessly
  }

  res.json({ received: true });
});

export default router;
