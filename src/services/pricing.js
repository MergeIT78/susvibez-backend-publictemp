import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

const EUR_RATE = 0.92; // real USD→EUR conversion ($28.99 → €26.67); fixed so charge == displayed price. Mirrors the storefront's Currency module

// Unit price replicating the storefront's Currency.getPrice() + sale logic,
// so the amount we charge always matches what the customer saw.
// Precedence: sale price → country-specific price → EUR conversion → USD base.
export function unitPrice(product, country, currency) {
  if (product.onSale && product.salePrice) return product.salePrice;
  const cp = (product.countryPricing || []).find(c => c.countryCode === country);
  if (cp) return cp.price;
  if (currency === 'EUR') return +(product.basePrice * EUR_RATE).toFixed(2);
  return product.basePrice;
}

/**
 * Recompute an order's pricing entirely from the database — never trust
 * client-supplied prices/totals. Also validates stock and the coupon.
 *
 * @param items     [{ product|productId, color, size, quantity }]
 * @returns { lineItems, subtotal, discount, total, currency, coupon }
 * @throws on empty cart, missing/inactive product, or insufficient stock
 */
export async function priceOrder({ items, couponCode, country, currency, checkStock = true }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Cart is empty');
  const cur = currency === 'EUR' ? 'EUR' : 'USD';

  const lineItems = [];
  let subtotal = 0;

  for (const it of items) {
    const productId = it.product || it.productId;
    const product = await Product.findById(productId);
    if (!product || !product.active) throw new Error('A product in your cart is no longer available');

    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    const price = unitPrice(product, country, cur);

    // Stock check (only when the variant/size is found; lenient otherwise)
    const variant = (product.variants || []).find(v => v.color === it.color);
    const sizeRow = variant?.sizes?.find(s => s.size === it.size);
    if (checkStock && sizeRow && sizeRow.stock < qty) {
      throw new Error(`Not enough stock for ${product.name} (${it.color} / ${it.size})`);
    }

    subtotal += price * qty;
    lineItems.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0] || '',
      color: it.color,
      size: it.size,
      price,
      currency: cur,
      quantity: qty,
    });
  }
  subtotal = +subtotal.toFixed(2);

  // Coupon — validated the same way as /coupons/validate. Invalid → silently ignored.
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    const c = await Coupon.findOne({ code: String(couponCode).toUpperCase(), active: true });
    if (c) {
      const expired = c.expiresAt && new Date() > c.expiresAt;
      const maxed = c.maxUses > 0 && c.usedCount >= c.maxUses;
      const belowMin = subtotal < (c.minOrder || 0);
      if (!expired && !maxed && !belowMin) {
        discount = c.type === 'percentage' ? (subtotal * c.value) / 100 : c.value;
        discount = +Math.min(discount, subtotal).toFixed(2);
        coupon = c;
      }
    }
  }

  const total = +Math.max(0, subtotal - discount).toFixed(2);
  return { lineItems, subtotal, discount, total, currency: cur, coupon };
}
