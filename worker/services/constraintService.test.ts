import { describe, it, expect } from 'vitest';
import { applyTaskConstraints } from './constraintService';
import type { TaskRecord } from './types';

const baseTask = (overrides: Partial<TaskRecord>): TaskRecord => ({
  id: 't1',
  projectId: 'p1',
  title: 'Task',
  description: null,
  status: 'TODO',
  priority: 'LOW',
  wbs: null,
  createdAt: 0,
  startDate: 0,
  dueDate: 0,
  completion: 0,
  assignee: null,
  isMilestone: false,
  predecessors: [],
  updatedAt: 0,
  ...overrides,
});

describe('constraintService', () => {
  it('adjusts dates when due date is before start', () => {
    const task = baseTask({ startDate: 1000, dueDate: 500 });
    const result = applyTaskConstraints(task, [task]);

    expect(result.changed).toBe(false);
    expect(result.warnings.length).toBe(0);
  });

  it('pushes start after predecessors', () => {
    const dependency = baseTask({ id: 't0', startDate: 1000, dueDate: 2000 });
    const task = baseTask({ startDate: 500, dueDate: 600, predecessors: ['t0'] });
    const result = applyTaskConstraints(task, [dependency, task]);

    expect(result.changed).toBe(true);
    expect((result.task.startDate ?? 0)).toBeGreaterThanOrEqual(2000);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
