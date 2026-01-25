import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import { workspaceMiddleware } from './middleware';
import { applyDraft, createDraft, discardDraft, getDraftById, listDrafts } from '../services/draftService';
import { recordLog } from '../services/logService';
import { generateId } from '../services/utils';
import type { DraftAction } from '../services/types';
import type { Variables } from '../types';

export const draftsRoute = new Hono<{ Variables: Variables }>();
draftsRoute.use('*', workspaceMiddleware);

const actionSchema = z.object({
  id: z.string().optional(),
  entityType: z.enum(['task', 'project']),
  action: z.enum(['create', 'update', 'delete']),
  entityId: z.string().optional(),
  after: z.record(z.string(), z.unknown()).optional(),
});

const createDraftSchema = z.object({
  projectId: z.string().optional(),
  createdBy: z.enum(['user', 'agent', 'system']).default('agent'),
  reason: z.string().optional(),
  actions: z.array(actionSchema).min(1),
});

const applySchema = z.object({
  actor: z.enum(['user', 'agent', 'system']).default('user'),
});

draftsRoute.get('/', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const drafts = await listDrafts(c.get('db'), workspace.id);
  return jsonOk(c, drafts);
});

draftsRoute.get('/:id', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const draft = await getDraftById(c.get('db'), c.req.param('id'), workspace.id);
  if (!draft) return jsonError(c, 'NOT_FOUND', 'Draft not found.', 404);
  return jsonOk(c, draft);
});

draftsRoute.post('/', zValidator('json', createDraftSchema), async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  try {
    const payload = c.req.valid('json') as z.infer<typeof createDraftSchema>;
    const actions: DraftAction[] = payload.actions.map(action => ({
      id: action.id ?? generateId(),
      entityType: action.entityType,
      action: action.action,
      entityId: action.entityId,
      after: action.after,
    }));
    const createdBy = payload.createdBy ?? 'agent';
    const result = await createDraft(c.get('db'), { ...payload, createdBy, actions, workspaceId: workspace.id });
    await recordLog(c.get('db'), 'tool_execution', {
      tool: 'planChanges',
      draftId: result.draft.id,
      warnings: result.warnings,
    });
    return jsonOk(c, result, 201);
  } catch (error) {
    return jsonError(c, 'CREATE_FAILED', error instanceof Error ? error.message : 'Failed to create draft.', 400);
  }
});

draftsRoute.post('/:id/apply', zValidator('json', applySchema), async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const payload = c.req.valid('json');
  try {
    const result = await applyDraft(c.get('db'), c.req.param('id'), payload.actor, workspace.id);
    await recordLog(c.get('db'), 'tool_execution', {
      tool: 'applyChanges',
      draftId: result.draft.id,
      results: result.results.length,
    });
    return jsonOk(c, result);
  } catch (error) {
    return jsonError(c, 'APPLY_FAILED', error instanceof Error ? error.message : 'Apply failed.', 400);
  }
});

draftsRoute.post('/:id/discard', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const draft = await discardDraft(c.get('db'), c.req.param('id'), workspace.id);
  if (!draft) return jsonError(c, 'NOT_FOUND', 'Draft not found.', 404);
  return jsonOk(c, draft);
});
