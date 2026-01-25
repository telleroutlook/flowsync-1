import { Hono } from 'hono';
import { z } from 'zod';
import { jsonError, jsonOk } from './helpers';
import { workspaceMiddleware } from './middleware';
import { getAuditLogById, isRollbackError, listAuditLogs, rollbackAuditLog } from '../services/auditService';
import type { Variables } from '../types';

export const auditRoute = new Hono<{ Variables: Variables }>();
auditRoute.use('*', workspaceMiddleware);

const querySchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  actor: z.enum(['user', 'agent', 'system']).optional(),
  action: z.string().optional(),
  entityType: z.enum(['project', 'task']).optional(),
  q: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
});

const rollbackSchema = z
  .object({
    actor: z.enum(['user', 'agent', 'system']).optional(),
    reason: z.string().optional(),
  })
  .transform((data) => ({ actor: data.actor ?? 'user', reason: data.reason }));

auditRoute.get('/', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) return jsonError(c, 'INVALID_QUERY', 'Invalid query parameters.', 400);
  const logs = await listAuditLogs(c.get('db'), { ...parsed.data, workspaceId: workspace.id });
  return jsonOk(c, logs);
});

auditRoute.get('/:id', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const entry = await getAuditLogById(c.get('db'), c.req.param('id'), workspace.id);
  if (!entry) return jsonError(c, 'NOT_FOUND', 'Audit log not found.', 404);
  return jsonOk(c, entry);
});

auditRoute.post('/:id/rollback', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const parsed = rollbackSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(c, 'INVALID_BODY', 'Invalid rollback payload.', 400);
  try {
    const result = await rollbackAuditLog(c.get('db'), c.req.param('id'), parsed.data, workspace.id);
    return jsonOk(c, result);
  } catch (error) {
    if (isRollbackError(error)) {
      return jsonError(c, error.code, error.message, error.status);
    }
    return jsonError(c, 'INTERNAL_ERROR', 'Failed to rollback audit log.', 500);
  }
});
