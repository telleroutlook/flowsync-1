import { and, eq, like, sql } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm';
import { tasks } from '../db/schema';
import { toTaskRecord } from './serializers';
import { clampNumber, generateId, now } from './utils';
import type { TaskRecord } from './types';

export type TaskFilters = {
  projectId?: string;
  status?: string;
  assignee?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

const buildWhere = (filters: TaskFilters) => {
  const clauses: SQLWrapper[] = [];
  if (filters.projectId) clauses.push(eq(tasks.projectId, filters.projectId));
  if (filters.status) clauses.push(eq(tasks.status, filters.status));
  if (filters.assignee) clauses.push(eq(tasks.assignee, filters.assignee));
  if (filters.q) clauses.push(like(tasks.title, `%${filters.q}%`));
  if (clauses.length === 0) return undefined;
  return and(...clauses);
};

export const listTasks = async (
  db: ReturnType<typeof import('../db').getDb>,
  filters: TaskFilters
): Promise<{ data: TaskRecord[]; total: number; page: number; pageSize: number }> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const whereClause = buildWhere(filters);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(whereClause);

  const rows = await db
    .select()
    .from(tasks)
    .where(whereClause)
    .orderBy(tasks.createdAt)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { data: rows.map(toTaskRecord), total: count, page, pageSize };
};

export const getTaskById = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string
): Promise<TaskRecord | null> => {
  const row = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  return row ? toTaskRecord(row) : null;
};

export const createTask = async (
  db: ReturnType<typeof import('../db').getDb>,
  data: {
    projectId: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    wbs?: string;
    startDate?: number;
    dueDate?: number;
    completion?: number;
    assignee?: string;
    isMilestone?: boolean;
    predecessors?: string[];
    createdAt?: number;
  }
): Promise<TaskRecord> => {
  const timestamp = now();
  const createdAt = data.createdAt ?? timestamp;
  const record = {
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    description: data.description ?? null,
    status: data.status,
    priority: data.priority,
    wbs: data.wbs ?? null,
    createdAt,
    startDate: data.startDate ?? createdAt,
    dueDate: data.dueDate ?? null,
    completion: clampNumber(data.completion, 0, 100) ?? 0,
    assignee: data.assignee ?? null,
    isMilestone: data.isMilestone ?? false,
    predecessors: data.predecessors ?? [],
    updatedAt: timestamp,
  };
  await db.insert(tasks).values(record);
  return toTaskRecord(record);
};

export const updateTask = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    wbs: string;
    startDate: number;
    dueDate: number;
    completion: number;
    assignee: string;
    isMilestone: boolean;
    predecessors: string[];
  }>
): Promise<TaskRecord | null> => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!existing) return null;

  const next = {
    title: data.title ?? existing.title,
    description: data.description ?? existing.description,
    status: data.status ?? existing.status,
    priority: data.priority ?? existing.priority,
    wbs: data.wbs ?? existing.wbs,
    startDate: data.startDate ?? existing.startDate,
    dueDate: data.dueDate ?? existing.dueDate,
    completion: clampNumber(data.completion ?? existing.completion ?? undefined, 0, 100),
    assignee: data.assignee ?? existing.assignee,
    isMilestone: data.isMilestone === undefined ? existing.isMilestone : data.isMilestone,
    predecessors: data.predecessors ?? existing.predecessors,
    updatedAt: now(),
  };

  await db.update(tasks).set(next).where(eq(tasks.id, id));
  return toTaskRecord({ ...existing, ...next });
};

export const deleteTask = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string
): Promise<TaskRecord | null> => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!existing) return null;
  await db.delete(tasks).where(eq(tasks.id, id));
  return toTaskRecord(existing);
};
