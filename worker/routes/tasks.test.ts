import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tasksRoute } from './tasks';

vi.mock('../services/taskService', () => ({
  listTasks: vi.fn(),
  getTaskById: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('../services/auditService', () => ({
  recordAudit: vi.fn(),
}));

import { listTasks, createTask, updateTask, deleteTask } from '../services/taskService';
import { recordAudit } from '../services/auditService';

const mockDb = {};

const buildApp = () => {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('db', mockDb as any);
    await next();
  });
  app.route('/api/tasks', tasksRoute);
  return app;
};

describe('tasksRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid query params', async () => {
    const app = buildApp();
    const res = await app.request('/api/tasks?page=bad');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_QUERY');
  });

  it('creates a task and records audit', async () => {
    (createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 't1', projectId: 'p1' });
    const app = buildApp();
    const res = await app.request('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1', title: 'Task', status: 'TODO', priority: 'LOW' }),
    });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.id).toBe('t1');
    expect(recordAudit).toHaveBeenCalled();
  });

  it('returns 404 for missing update target', async () => {
    (updateTask as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.request('/api/tasks/t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for missing delete target', async () => {
    (deleteTask as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.request('/api/tasks/t1', { method: 'DELETE' });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('lists tasks', async () => {
    (listTasks as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 });
    const app = buildApp();
    const res = await app.request('/api/tasks');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.total).toBe(0);
  });
});
