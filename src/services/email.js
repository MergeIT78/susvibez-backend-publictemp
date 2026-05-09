import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Order Confirmation ──────────────────────────────────
export async function sendOrderConfirmation(order) {
  const { customerEmail, customerName, orderNumber, items, totalAmount, shippingAddress } = order;

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">
        <strong>${item.name}</strong><br>
        <span style="color:#666;font-size:13px">${item.color} / ${item.size}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const addressHTML = shippingAddress ? `
    <p style="margin:0;color:#444;line-height:1.6">
      ${shippingAddress.line1}${shippingAddress.line2 ? ', ' + shippingAddress.line2 : ''}<br>
      ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}<br>
      ${shippingAddress.country}
    </p>
  ` : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:.1em;text-transform:uppercase">SUSVIBEZ</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.6);font-size:13px;letter-spacing:.05em">WEAR THE VIBE</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <h2 style="margin:0 0 8px;font-size:22px;font-weight:800">Order Confirmed! 🎉</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px">
              Hey ${customerName || 'there'}, thanks for your order. We're getting it ready for you!
            </p>

            <div style="background:#f9f9f9;border-radius:4px;padding:16px 20px;margin-bottom:28px">
              <p style="margin:0;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.08em">Order Number</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:800;letter-spacing:.05em">#${orderNumber}</p>
            </div>

            <!-- Items -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <thead>
                <tr style="border-bottom:2px solid #000">
                  <th style="padding:8px 0;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Item</th>
                  <th style="padding:8px 0;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Qty</th>
                  <th style="padding:8px 0;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Price</th>
                </tr>
              </thead>
              <tbody>${itemsHTML}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding:16px 0 0;font-weight:800;font-size:15px;text-transform:uppercase;letter-spacing:.05em">Total</td>
                  <td style="padding:16px 0 0;font-weight:800;font-size:18px;text-align:right">$${Number(totalAmount).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            ${shippingAddress ? `
            <!-- Shipping -->
            <div style="border-top:1px solid #eee;padding-top:24px;margin-bottom:28px">
              <p style="margin:0 0 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#888">Shipping To</p>
              ${addressHTML}
            </div>
            ` : ''}

            <p style="margin:0;color:#555;font-size:14px;line-height:1.6">
              Your order will be shipped within <strong>2-3 business days</strong>.
              You'll receive a tracking email once it's on its way.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee">
            <p style="margin:0 0 8px;font-size:13px;color:#888">Questions? Reply to this email or visit</p>
            <a href="https://susvibez.com" style="color:#000;font-weight:700;font-size:13px">susvibez.com</a>
            <p style="margin:16px 0 0;font-size:11px;color:#bbb">© 2025 SusVibez. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"SusVibez" <${process.env.EMAIL_USER}>`,
    to: customerEmail,
    subject: `Order Confirmed #${orderNumber} — SusVibez`,
    html,
  });

  console.log(`📧 Confirmation sent to ${customerEmail} for order #${orderNumber}`);
}
