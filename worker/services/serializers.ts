import type { ProjectRecord, TaskRecord } from './types';
import { safeJsonParse } from './utils';

export const toProjectRecord = (row: {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
}): ProjectRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  icon: row.icon,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toTaskRecord = (row: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  wbs: string | null;
  createdAt: number;
  startDate: number | null;
  dueDate: number | null;
  completion: number | null;
  assignee: string | null;
  isMilestone: number;
  predecessors: string | null;
  updatedAt: number;
}): TaskRecord => ({
  id: row.id,
  projectId: row.projectId,
  title: row.title,
  description: row.description,
  status: row.status as TaskRecord['status'],
  priority: row.priority as TaskRecord['priority'],
  wbs: row.wbs,
  createdAt: row.createdAt,
  startDate: row.startDate,
  dueDate: row.dueDate,
  completion: row.completion,
  assignee: row.assignee,
  isMilestone: row.isMilestone === 1,
  predecessors: safeJsonParse<string[]>(row.predecessors, []),
  updatedAt: row.updatedAt,
});
