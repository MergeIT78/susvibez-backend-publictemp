import Stripe from 'stripe';

// Single memoized Stripe client (lazy so dotenv runs first).
let _stripe = null;
export const getStripe = () => (_stripe ||= new Stripe(process.env.STRIPE_SECRET_KEY));
