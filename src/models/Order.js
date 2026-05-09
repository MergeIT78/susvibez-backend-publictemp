import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  image: String,
  color: String,
  size: String,
  price: Number,
  currency: String,
  quantity: { type: Number, default: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestEmail: { type: String, default: '' },
  items: [orderItemSchema],
  subtotal: Number,
  discount: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: Number,
  currency: { type: String, default: 'USD' },
  couponCode: { type: String, default: '' },
  shippingAddress: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  fulfillmentStatus: {
    type: String,
    enum: ['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'unfulfilled'
  },
  stripePaymentIntentId: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = 'SV-' + Date.now().toString(36).toUpperCase();
  }
  next();
});

export default mongoose.model('Order', orderSchema);
