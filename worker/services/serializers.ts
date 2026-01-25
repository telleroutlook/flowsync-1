import type { ProjectRecord, TaskRecord } from './types';

export const toProjectRecord = (row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
}): ProjectRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
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
  isMilestone: boolean;
  predecessors: string[] | null;
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
  isMilestone: row.isMilestone,
  predecessors: row.predecessors ?? [],
  updatedAt: row.updatedAt,
});
