import { serve } from '@hono/node-server';
import { createApp } from '../worker/app';
import { getDb } from '../worker/db';
import { ensureSeedData } from '../worker/services/seedService';
import type { Bindings } from '../worker/app';

const app = createApp();

// Initialize PostgreSQL connection
const db = getDb();

// Inject db and environment variables into context
app.use('*', async (c, next) => {
  c.set('db', db);
  // Inject environment variables as c.env for compatibility
  c.env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  } as Bindings;
  await next();
});

// Ensure seed data on startup (not on every request)
ensureSeedData(db).catch(console.error);

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server is running on http://localhost:${port}`);
