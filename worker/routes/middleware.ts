import type { Context, Next } from 'hono';
import { jsonError } from './helpers';
import { getUserFromToken, parseAuthHeader } from '../services/authService';
import { getWorkspaceById, getWorkspaceMembership, PUBLIC_WORKSPACE_ID } from '../services/workspaceService';
import type { Variables } from '../types';

export const authMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const token = parseAuthHeader(c.req.header('Authorization'));
  const user = token ? await getUserFromToken(c.get('db'), token) : null;
  c.set('user', user ?? null);
  c.set('workspace', null);
  c.set('workspaceMembership', null);
  await next();
};

export const workspaceMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const requestedId = c.req.header('X-Workspace-Id') || c.req.query('workspaceId');
  const workspaceId = requestedId || PUBLIC_WORKSPACE_ID;
  const workspace = await getWorkspaceById(c.get('db'), workspaceId);
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);

  const user = c.get('user');
  if (!workspace.isPublic) {
    if (!user) return jsonError(c, 'UNAUTHORIZED', 'Login required to access this workspace.', 401);
    const membership = await getWorkspaceMembership(c.get('db'), workspaceId, user.id);
    if (!membership) return jsonError(c, 'WORKSPACE_FORBIDDEN', 'You are not a member of this workspace.', 403);
    if (membership.status !== 'active') {
      return jsonError(c, 'WORKSPACE_PENDING', 'Workspace access pending approval.', 403);
    }
    c.set('workspaceMembership', membership);
  } else if (user) {
    const membership = await getWorkspaceMembership(c.get('db'), workspaceId, user.id);
    c.set('workspaceMembership', membership ?? null);
  }

  c.set('workspace', workspace);
  await next();
};
