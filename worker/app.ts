import { Hono } from 'hono';
import type { Variables, Bindings, DrizzleDB } from './types';
import { projectsRoute } from './routes/projects';
import { tasksRoute } from './routes/tasks';
import { draftsRoute } from './routes/drafts';
import { auditRoute } from './routes/audit';
import { aiRoute } from './routes/ai';

export { Variables, Bindings };

export const createApp = (db: DrizzleDB, bindings: Bindings) => {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // Middleware to inject db and env bindings - must be before routes
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.env = bindings;
    await next();
  });

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
