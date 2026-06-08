/**
 * One-time import of the scraped Etsy reviews into the review LIBRARY.
 * Run locally (connects to Atlas):  node src/import-reviews.js
 * Reads ../../../reviews_import/reviews_master.json (produced by the parser).
 * Idempotent: skips reviews already present (same author + text + rating).
 */
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS — fixes Atlas SRV lookup on some networks
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import Review from './models/Review.js';

const file = join(__dirname, '../../../reviews_import/reviews_master.json');
if (!fs.existsSync(file)) {
  console.error('❌ reviews_master.json not found at', file);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected. Importing', data.length, 'reviews...');

let added = 0, skipped = 0;
for (const r of data) {
  const exists = await Review.findOne({ author: r.name, text: r.text, rating: r.rating });
  if (exists) { skipped++; continue; }
  await Review.create({
    author: r.name, location: '', rating: r.rating, text: r.text,
    verified: true, date: r.date, source: 'etsy', originalItem: r.itemTitle,
  });
  added++;
}

console.log(`✓ Done. Added ${added}, skipped (already present) ${skipped}. Library total: ${await Review.countDocuments()}`);
await mongoose.disconnect();
process.exit(0);
