import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditRoute } from './audit';
import type { Variables } from '../types';

vi.mock('../services/auditService', () => ({
  listAuditLogs: vi.fn(),
  getAuditLogById: vi.fn(),
  rollbackAuditLog: vi.fn(),
  isRollbackError: vi.fn(),
}));

vi.mock('./middleware', () => ({
  workspaceMiddleware: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>
  ) => {
    c.set('workspace', { id: 'public', name: 'Public', description: null, createdAt: 0, createdBy: null, isPublic: true });
    c.set('workspaceMembership', null);
    await next();
  },
}));

import { getAuditLogById, rollbackAuditLog, isRollbackError } from '../services/auditService';

const mockDb = {};

const buildApp = () => {
  const app = new Hono<{ Variables: Variables }>();
  app.use('*', async (c, next) => {
    c.set('db', mockDb as any);
    c.set('user', null);
    c.set('workspace', null);
    c.set('workspaceMembership', null);
    await next();
  });
  app.route('/api/audit', auditRoute);
  return app;
};

describe('auditRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid query params', async () => {
    const app = buildApp();
    const res = await app.request('/api/audit?page=bad');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_QUERY');
  });

  it('returns 404 for missing audit entry', async () => {
    (getAuditLogById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.request('/api/audit/a1');
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('maps rollback errors from service', async () => {
    const error = Object.assign(new Error('Nope'), { code: 'INVALID_ROLLBACK', status: 409, message: 'Nope' });
    (rollbackAuditLog as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    (isRollbackError as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const app = buildApp();
    const res = await app.request('/api/audit/a1/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'user' }),
    });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error.code).toBe('INVALID_ROLLBACK');
  });
});
