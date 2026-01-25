import { config } from 'dotenv';
import { serve } from '@hono/node-server';
import { createApp } from '../worker/app';
import { getDb } from '../worker/db';
import { ensureSeedData } from '../worker/services/seedService';
import type { Bindings } from '../worker/app';

// Load .env file, overriding system environment variables
const envResult = config({ override: true });
if (envResult.error) {
  // Silently fail on .env load error
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
ensureSeedData(db).catch(() => {
  // Silently fail on seed error
});

const port = parseInt(process.env.PORT || '8788', 10);

serve({
  fetch: app.fetch,
  port,
});
