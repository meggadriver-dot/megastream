import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env');

if (!process.env.VERCEL && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}
