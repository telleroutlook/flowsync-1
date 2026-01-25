import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import {
  approveWorkspaceRequest,
  createWorkspace,
  getWorkspaceMembership,
  listPublicWorkspaces,
  listWorkspaceMembers,
  listWorkspaceRequests,
  listWorkspacesForUser,
  requestJoinWorkspace,
  rejectWorkspaceRequest,
  removeWorkspaceMember,
} from '../services/workspaceService';
import type { Variables } from '../types';

export const workspacesRoute = new Hono<{ Variables: Variables }>();

const workspaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

workspacesRoute.get('/', async (c) => {
  const user = c.get('user');
  const workspaces = user
    ? await listWorkspacesForUser(c.get('db'), user.id)
    : await listPublicWorkspaces(c.get('db'));
  return jsonOk(c, workspaces);
});

workspacesRoute.post('/', zValidator('json', workspaceSchema), async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  const payload = c.req.valid('json');
  const workspace = await createWorkspace(c.get('db'), {
    name: payload.name,
    description: payload.description,
    createdBy: user.id,
  });
  return jsonOk(c, workspace, 201);
});

workspacesRoute.post('/:id/join', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  try {
    const membership = await requestJoinWorkspace(c.get('db'), {
      workspaceId: c.req.param('id'),
      userId: user.id,
    });
    return jsonOk(c, membership);
  } catch (error) {
    return jsonError(c, 'JOIN_FAILED', error instanceof Error ? error.message : 'Join failed.', 400);
  }
});

workspacesRoute.get('/:id/requests', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  const workspaceId = c.req.param('id');
  const membership = await getWorkspaceMembership(c.get('db'), workspaceId, user.id);
  if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
    return jsonError(c, 'FORBIDDEN', 'Admin access required.', 403);
  }
  const requests = await listWorkspaceRequests(c.get('db'), workspaceId);
  return jsonOk(c, requests);
});

workspacesRoute.get('/:id/members', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  const workspaceId = c.req.param('id');
  const membership = await getWorkspaceMembership(c.get('db'), workspaceId, user.id);
  if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
    return jsonError(c, 'FORBIDDEN', 'Admin access required.', 403);
  }
  const members = await listWorkspaceMembers(c.get('db'), workspaceId);
  return jsonOk(c, members);
});

workspacesRoute.post('/:id/requests/:userId/approve', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  try {
    const membership = await approveWorkspaceRequest(c.get('db'), {
      workspaceId: c.req.param('id'),
      userId: c.req.param('userId'),
      approverId: user.id,
    });
    return jsonOk(c, membership);
  } catch (error) {
    return jsonError(c, 'APPROVE_FAILED', error instanceof Error ? error.message : 'Approve failed.', 400);
  }
});

workspacesRoute.post('/:id/requests/:userId/reject', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  try {
    const result = await rejectWorkspaceRequest(c.get('db'), {
      workspaceId: c.req.param('id'),
      userId: c.req.param('userId'),
      approverId: user.id,
    });
    return jsonOk(c, result);
  } catch (error) {
    return jsonError(c, 'REJECT_FAILED', error instanceof Error ? error.message : 'Reject failed.', 400);
  }
});

workspacesRoute.delete('/:id/members/:userId', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required.', 401);
  try {
    const result = await removeWorkspaceMember(c.get('db'), {
      workspaceId: c.req.param('id'),
      userId: c.req.param('userId'),
      removerId: user.id,
    });
    return jsonOk(c, result);
  } catch (error) {
    return jsonError(c, 'REMOVE_MEMBER_FAILED', error instanceof Error ? error.message : 'Remove member failed.', 400);
  }
});
