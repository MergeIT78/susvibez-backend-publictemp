import Order from '../models/Order.js';
import { sendOrderConfirmation } from './email.js';

/**
 * Send the order-confirmation email AT MOST ONCE per order.
 *
 * Uses an atomic claim on `confirmationSentAt` so that whichever path runs
 * first (order creation OR the Stripe webhook, including webhook retries)
 * sends exactly one email. On failure the claim is rolled back so a later
 * retry can still send it.
 *
 * @returns true if this call sent the email, false if already sent / skipped
 */
export async function sendConfirmationOnce(orderId, { receiptUrl } = {}) {
  // Atomically claim the send (only succeeds if not already sent)
  const order = await Order.findOneAndUpdate(
    { _id: orderId, confirmationSentAt: null },
    { confirmationSentAt: new Date() },
    { new: true }
  );
  if (!order) return false; // already sent by another path

  const addr = order.shippingAddress || {};
  const customerEmail = addr.email || order.guestEmail;
  if (!customerEmail) return false;

  try {
    await sendOrderConfirmation({
      customerEmail,
      customerName: [addr.firstName, addr.lastName].filter(Boolean).join(' '),
      orderNumber: order.orderNumber,
      items: order.items,
      totalAmount: order.total,
      currency: order.currency,
      shippingAddress: addr.address
        ? { line1: addr.address, city: addr.city, state: addr.state, zip: addr.zip, country: addr.country }
        : null,
      receiptUrl: receiptUrl || order.stripeReceiptUrl || '',
    });
    return true;
  } catch (err) {
    console.error('📧 Order confirmation email failed (non-fatal):', err.message);
    // Roll back the claim so a later retry (e.g. the webhook) can send it
    await Order.updateOne({ _id: orderId }, { confirmationSentAt: null }).catch(() => {});
    return false;
  }
}
