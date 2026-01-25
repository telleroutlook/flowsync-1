import { and, eq, gte, like, lte, or, sql } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm';
import { projects, tasks } from '../db/schema';
import { toTaskRecord } from './serializers';
import { clampNumber, generateId, now } from './utils';
import type { Priority, TaskRecord, TaskStatus } from './types';

export type TaskFilters = {
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignee?: string;
  isMilestone?: boolean;
  q?: string;
  startDateFrom?: number;
  startDateTo?: number;
  dueDateFrom?: number;
  dueDateTo?: number;
  page?: number;
  pageSize?: number;
};

const buildWhere = (filters: TaskFilters) => {
  const clauses: SQLWrapper[] = [];
  if (filters.projectId) clauses.push(eq(tasks.projectId, filters.projectId));
  if (filters.status) clauses.push(eq(tasks.status, filters.status));
  if (filters.priority) clauses.push(eq(tasks.priority, filters.priority));
  if (filters.assignee) clauses.push(eq(tasks.assignee, filters.assignee));
  if (filters.isMilestone !== undefined) clauses.push(eq(tasks.isMilestone, filters.isMilestone));
  if (filters.startDateFrom !== undefined) clauses.push(gte(tasks.startDate, filters.startDateFrom));
  if (filters.startDateTo !== undefined) clauses.push(lte(tasks.startDate, filters.startDateTo));
  if (filters.dueDateFrom !== undefined) clauses.push(gte(tasks.dueDate, filters.dueDateFrom));
  if (filters.dueDateTo !== undefined) clauses.push(lte(tasks.dueDate, filters.dueDateTo));
  if (filters.q) {
    const query = `%${filters.q}%`;
    clauses.push(
      or(
        like(tasks.title, query),
        like(sql`coalesce(${tasks.description}, '')`, query)
      )
    );
  }
  if (clauses.length === 0) return undefined;
  return and(...clauses);
};

export const listTasks = async (
  db: ReturnType<typeof import('../db').getDb>,
  filters: TaskFilters,
  workspaceId: string
): Promise<{ data: TaskRecord[]; total: number; page: number; pageSize: number }> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const whereClause = buildWhere(filters);
  const workspaceClause = eq(projects.workspaceId, workspaceId);
  const combinedClause = whereClause ? and(whereClause, workspaceClause) : workspaceClause;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(combinedClause);

  const rows = await db
    .select()
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(combinedClause)
    .orderBy(tasks.createdAt)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { data: rows.map((row) => toTaskRecord(row.tasks)), total: count, page, pageSize };
};

export const getTaskById = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<TaskRecord | null> => {
  const rows = await db
    .select()
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  return row ? toTaskRecord(row.tasks) : null;
};

export const createTask = async (
  db: ReturnType<typeof import('../db').getDb>,
  data: {
    id?: string;
    projectId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    wbs?: string;
    startDate?: number;
    dueDate?: number;
    completion?: number;
    assignee?: string;
    isMilestone?: boolean;
    predecessors?: string[];
    createdAt?: number;
    updatedAt?: number;
  },
  workspaceId: string
): Promise<TaskRecord | null> => {
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, data.projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  if (projectRows.length === 0) return null;

  const timestamp = now();
  const createdAt = data.createdAt ?? timestamp;
  const updatedAt = data.updatedAt ?? timestamp;
  const record = {
    id: data.id ?? generateId(),
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
    updatedAt,
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
    status: TaskStatus;
    priority: Priority;
    wbs: string;
    startDate: number;
    dueDate: number;
    completion: number;
    assignee: string;
    isMilestone: boolean;
    predecessors: string[];
  }>,
  workspaceId: string
): Promise<TaskRecord | null> => {
  const existing = await getTaskById(db, id, workspaceId);
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
  return { ...existing, ...next };
};

export const deleteTask = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<TaskRecord | null> => {
  const existing = await getTaskById(db, id, workspaceId);
  if (!existing) return null;
  await db.delete(tasks).where(eq(tasks.id, id));
  return existing;
};
