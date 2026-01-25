import type { TaskRecord } from './types';

const day = 86_400_000;

const getTaskStart = (task: TaskRecord) => task.startDate ?? task.createdAt;
const getTaskEnd = (task: TaskRecord) => {
  const start = getTaskStart(task);
  const end = task.dueDate ?? start + day;
  return end <= start ? start + day : end;
};

export type ConstraintResult = {
  task: TaskRecord;
  warnings: string[];
  changed: boolean;
};

export const enforceDateOrder = (task: TaskRecord): ConstraintResult => {
  const start = getTaskStart(task);
  const end = getTaskEnd(task);
  if (end > start) {
    return { task, warnings: [], changed: false };
  }
  return {
    task: { ...task, startDate: start, dueDate: start + day },
    warnings: ['Adjusted task dates to ensure due date is after start date.'],
    changed: true,
  };
};

export const resolveDependencyConflicts = (task: TaskRecord, allTasks: TaskRecord[]): ConstraintResult => {
  if (!task.predecessors.length) return { task, warnings: [], changed: false };
  const start = getTaskStart(task);
  const end = getTaskEnd(task);
  let maxEnd = start;
  for (const ref of task.predecessors) {
    const match = allTasks.find(
      (candidate) => candidate.projectId === task.projectId && (candidate.id === ref || candidate.wbs === ref)
    );
    if (match) {
      maxEnd = Math.max(maxEnd, getTaskEnd(match));
    }
  }

  if (maxEnd <= start) return { task, warnings: [], changed: false };
  const duration = Math.max(day, end - start);
  const nextStart = maxEnd;
  const nextEnd = Math.max(nextStart + day, nextStart + duration);
  return {
    task: { ...task, startDate: nextStart, dueDate: nextEnd },
    warnings: ['Adjusted task dates to satisfy predecessor dependencies.'],
    changed: true,
  };
};

export const applyTaskConstraints = (task: TaskRecord, allTasks: TaskRecord[]) => {
  const warnings: string[] = [];
  let nextTask = task;
  let changed = false;

  const dependencyResult = resolveDependencyConflicts(nextTask, allTasks);
  if (dependencyResult.changed) {
    changed = true;
    nextTask = dependencyResult.task;
    warnings.push(...dependencyResult.warnings);
  }

  const dateResult = enforceDateOrder(nextTask);
  if (dateResult.changed) {
    changed = true;
    nextTask = dateResult.task;
    warnings.push(...dateResult.warnings);
  }

  return { task: nextTask, warnings, changed, violated: false };
};
