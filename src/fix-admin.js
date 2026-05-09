/**
 * One-shot fix: resets admin@susvibez.com password to admin123 and sets role=admin
 * Run from backend folder:  node src/fix-admin.js
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB:', process.env.MONGODB_URI);

const email    = process.env.ADMIN_EMAIL    || 'admin@susvibez.com';
const password = process.env.ADMIN_PASSWORD || 'admin123';
const hash     = await bcrypt.hash(password, 10);

const result = await mongoose.connection.collection('users').findOneAndUpdate(
  { email },
  { $set: { password: hash, role: 'admin' } },
  { returnDocument: 'after', upsert: true }
);

const user = result?.value || result;
console.log(`\n✅  Admin fixed!`);
console.log(`   Email:    ${email}`);
console.log(`   Password: ${password}`);
console.log(`   Role:     ${user?.role || 'admin'}`);
console.log(`   _id:      ${user?._id}`);

await mongoose.disconnect();
process.exit(0);
