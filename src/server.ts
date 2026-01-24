import { config } from 'dotenv';
import { serve } from '@hono/node-server';
import { createApp } from '../worker/app';
import { getDb } from '../worker/db';
import { ensureSeedData } from '../worker/services/seedService';
import type { Bindings } from '../worker/app';

// 加载 .env 文件，覆盖系统环境变量
const envResult = config({ override: true });
if (envResult.error) {
  console.error('Error loading .env file:', envResult.error);
}

// Initialize PostgreSQL connection
const db = getDb();

// Prepare environment bindings
const bindings: Bindings = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

// Create app with db and bindings
const app = createApp(db, bindings);

// Ensure seed data on startup (not on every request)
ensureSeedData(db).catch(console.error);

const port = parseInt(process.env.PORT || '8788', 10);

console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server is running on http://localhost:${port}`);
