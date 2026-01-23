import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from './db';
import { ensureSeedData } from './services/seedService';
import { projectsRoute } from './routes/projects';
import { tasksRoute } from './routes/tasks';
import { draftsRoute } from './routes/drafts';
import { auditRoute } from './routes/audit';
import { geminiRoute } from './routes/gemini';

export type Bindings = {
  GEMINI_API_KEY: string;
  DB: D1Database;
};

type Variables = {
  db: ReturnType<typeof getDb>;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const db = getDb(c.env.DB);
  c.set('db', db);
  await ensureSeedData(db);
  await next();
});

app.route('/', geminiRoute);
app.route('/api/projects', projectsRoute);
app.route('/api/tasks', tasksRoute);
app.route('/api/drafts', draftsRoute);
app.route('/api/audit', auditRoute);

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } }, 500);
});

export default app;
