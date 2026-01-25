import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import { createSession, createUser, getUserByUsername, parseAuthHeader, revokeSession, verifyPassword } from '../services/authService';
import type { Variables } from '../types';

export const authRoute = new Hono<{ Variables: Variables }>();

const credentialsSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(6),
});

authRoute.post('/register', zValidator('json', credentialsSchema), async (c) => {
  const data = c.req.valid('json');
  const existing = await getUserByUsername(c.get('db'), data.username);
  if (existing) return jsonError(c, 'USER_EXISTS', 'Username already exists.', 409);
  const user = await createUser(c.get('db'), { username: data.username, password: data.password });
  const session = await createSession(c.get('db'), user.id);
  return jsonOk(c, { user, token: session.token, expiresAt: session.expiresAt }, 201);
});

authRoute.post('/login', zValidator('json', credentialsSchema), async (c) => {
  const data = c.req.valid('json');
  const existing = await getUserByUsername(c.get('db'), data.username);
  if (!existing) return jsonError(c, 'INVALID_CREDENTIALS', 'Invalid username or password.', 401);
  const ok = await verifyPassword(data.password, existing.passwordHash);
  if (!ok) return jsonError(c, 'INVALID_CREDENTIALS', 'Invalid username or password.', 401);
  const session = await createSession(c.get('db'), existing.user.id);
  return jsonOk(c, { user: existing.user, token: session.token, expiresAt: session.expiresAt });
});

authRoute.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return jsonError(c, 'UNAUTHORIZED', 'Not logged in.', 401);
  return jsonOk(c, { user });
});

authRoute.post('/logout', async (c) => {
  const token = parseAuthHeader(c.req.header('Authorization'));
  if (!token) return jsonError(c, 'INVALID_TOKEN', 'Missing auth token.', 400);
  await revokeSession(c.get('db'), token);
  return jsonOk(c, { success: true });
});
