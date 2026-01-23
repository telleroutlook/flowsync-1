import { Hono } from 'hono';
import { z } from 'zod';
import { jsonError, jsonOk } from './helpers';
import { listAuditLogs } from '../services/auditService';

const querySchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
});

export const auditRoute = new Hono<{ Variables: { db: ReturnType<typeof import('../db').getDb> } }>();

auditRoute.get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) return jsonError(c, 'INVALID_QUERY', 'Invalid query parameters.', 400);
  const logs = await listAuditLogs(c.get('db'), parsed.data);
  return jsonOk(c, logs);
});
