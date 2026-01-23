import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { draftsRoute } from './drafts';

vi.mock('../services/draftService', () => ({
  listDrafts: vi.fn(),
  getDraftById: vi.fn(),
  createDraft: vi.fn(),
  applyDraft: vi.fn(),
  discardDraft: vi.fn(),
}));

vi.mock('../services/logService', () => ({
  recordLog: vi.fn(),
}));

vi.mock('../services/utils', () => ({
  generateId: () => 'gen-1',
}));

import { createDraft, applyDraft, discardDraft } from '../services/draftService';
import { recordLog } from '../services/logService';

const mockDb = {};

const buildApp = () => {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('db', mockDb as any);
    await next();
  });
  app.route('/api/drafts', draftsRoute);
  return app;
};

describe('draftsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a draft and records log', async () => {
    (createDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
      draft: { id: 'd1', status: 'pending', actions: [], createdAt: 1, createdBy: 'agent', projectId: null, reason: null },
      warnings: [],
    });

    const app = buildApp();
    const res = await app.request('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createdBy: 'agent',
        actions: [{ entityType: 'task', action: 'create', after: { title: 'Task' } }],
      }),
    });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.draft.id).toBe('d1');
    const call = (createDraft as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.actions[0].id).toBe('gen-1');
    expect(recordLog).toHaveBeenCalled();
  });

  it('returns apply failure when service throws', async () => {
    (applyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const app = buildApp();
    const res = await app.request('/api/drafts/d1/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'user' }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('APPLY_FAILED');
  });

  it('returns 404 when discard target missing', async () => {
    (discardDraft as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.request('/api/drafts/d1/discard', { method: 'POST' });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});
