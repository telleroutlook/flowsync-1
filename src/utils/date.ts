import type { Task } from '../../types';

const DAY_MS = 86400000;

export function getTaskStart(task: Task): number {
  return task.startDate ?? task.createdAt;
}

export function getTaskEnd(task: Task): number {
  const start = getTaskStart(task);
  const end = task.dueDate ?? start + DAY_MS;
  return end <= start ? start + DAY_MS : end;
}

export function formatExportDate(value?: number): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function parseDateFlexible(value?: string): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) return numeric;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return parsed;

  return undefined;
}
