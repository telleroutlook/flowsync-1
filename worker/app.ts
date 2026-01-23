import { Hono } from 'hono';
import type { DrizzleDB } from './db';
import { projectsRoute } from './routes/projects';
import { tasksRoute } from './routes/tasks';
import { draftsRoute } from './routes/drafts';
import { auditRoute } from './routes/audit';
import { aiRoute } from './routes/ai';

export type Bindings = {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};

export type Variables = {
  db: DrizzleDB;
};

export const createApp = () => {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  app.route('/', aiRoute);
  app.route('/api/projects', projectsRoute);
  app.route('/api/tasks', tasksRoute);
  app.route('/api/drafts', draftsRoute);
  app.route('/api/audit', auditRoute);

  app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } }, 500);
  });

  return app;
};
