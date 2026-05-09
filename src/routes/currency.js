import express from 'express';

const router = express.Router();

// EU countries (use EUR)
const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  // non-EU but euro-zone adjacent
  'AL','AD','BA','ME','MK','MC','RS','SM','XK','VA','MD'
]);

const getClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip;
};

// GET /api/currency  — returns { currency: 'USD'|'EUR', country, symbol }
router.get('/', async (req, res) => {
  try {
    let ip = getClientIP(req);

    // strip IPv6 loopback
    if (ip === '::1' || ip === '127.0.0.1' || ip?.startsWith('::ffff:127')) {
      // localhost — default to USD
      return res.json({ currency: 'USD', country: 'US', symbol: '$' });
    }

    // strip IPv6 prefix
    if (ip?.startsWith('::ffff:')) ip = ip.slice(7);

    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    const geo = await geoRes.json();
    const countryCode = geo.countryCode || 'US';
    const currency = EU_COUNTRIES.has(countryCode) ? 'EUR' : 'USD';
    const symbol = currency === 'EUR' ? '€' : '$';
    res.json({ currency, country: countryCode, symbol });
  } catch {
    res.json({ currency: 'USD', country: 'US', symbol: '$' });
  }
});

export default router;
