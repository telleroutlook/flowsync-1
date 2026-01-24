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
  let violated = false;  // 新增：标记是否违反了约束

  console.log('[applyTaskConstraints] Input task:', {
    id: task.id,
    title: task.title,
    startDate: task.startDate,
    dueDate: task.dueDate,
    predecessors: task.predecessors
  });

  const dependencyResult = resolveDependencyConflicts(nextTask, allTasks);
  if (dependencyResult.changed) {
    console.log('[applyTaskConstraints] Dependency constraints applied:', {
      before: { startDate: nextTask.startDate, dueDate: nextTask.dueDate },
      after: { startDate: dependencyResult.task.startDate, dueDate: dependencyResult.task.dueDate },
      warnings: dependencyResult.warnings
    });
    changed = true;
    nextTask = dependencyResult.task;
    warnings.push(...dependencyResult.warnings);
  }

  const dateResult = enforceDateOrder(nextTask);
  if (dateResult.changed) {
    console.log('[applyTaskConstraints] Date order constraints applied:', {
      before: { startDate: nextTask.startDate, dueDate: nextTask.dueDate },
      after: { startDate: dateResult.task.startDate, dueDate: dateResult.task.dueDate },
      warnings: dateResult.warnings
    });
    changed = true;
    nextTask = dateResult.task;
    warnings.push(...dateResult.warnings);
  }

  console.log('[applyTaskConstraints] Output task:', {
    id: nextTask.id,
    title: nextTask.title,
    startDate: nextTask.startDate,
    dueDate: nextTask.dueDate,
    changed,
    warnings
  });

  return { task: nextTask, warnings, changed, violated };
};
