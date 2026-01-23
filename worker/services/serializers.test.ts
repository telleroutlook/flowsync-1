import { describe, it, expect } from 'vitest';
import { toTaskRecord } from './serializers';

describe('serializers', () => {
  it('parses task record fields', () => {
    const record = toTaskRecord({
      id: 't1',
      projectId: 'p1',
      title: 'Task',
      description: null,
      status: 'TODO',
      priority: 'LOW',
      wbs: null,
      createdAt: 1,
      startDate: 1,
      dueDate: 2,
      completion: 0,
      assignee: null,
      isMilestone: 1,
      predecessors: '["a","b"]',
      updatedAt: 1,
    });

    expect(record.isMilestone).toBe(true);
    expect(record.predecessors).toEqual(['a', 'b']);
  });

  it('falls back on invalid predecessors JSON', () => {
    const record = toTaskRecord({
      id: 't1',
      projectId: 'p1',
      title: 'Task',
      description: null,
      status: 'TODO',
      priority: 'LOW',
      wbs: null,
      createdAt: 1,
      startDate: 1,
      dueDate: 2,
      completion: 0,
      assignee: null,
      isMilestone: 0,
      predecessors: '{bad',
      updatedAt: 1,
    });

    expect(record.predecessors).toEqual([]);
  });
});
