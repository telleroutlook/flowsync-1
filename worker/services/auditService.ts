import { and, desc, eq, sql, like, or, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { auditLogs, projects, tasks } from '../db/schema';
import type { AuditRecord, ProjectRecord, TaskRecord } from './types';
import { generateId, now, safeJsonParse, toSqlBoolean } from './utils';
import { toProjectRecord, toTaskRecord } from './serializers';

class RollbackError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const projectSnapshotSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .transform((data) => ({
    id: data.id,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }));

const taskSnapshotSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: z.string(),
    priority: z.string(),
    wbs: z.string().nullable().optional(),
    createdAt: z.number(),
    startDate: z.number().nullable().optional(),
    dueDate: z.number().nullable().optional(),
    completion: z.number().nullable().optional(),
    assignee: z.string().nullable().optional(),
    isMilestone: z.boolean(),
    predecessors: z.array(z.string()).optional().default([]),
    updatedAt: z.number(),
  })
  .transform((data) => ({
    id: data.id,
    projectId: data.projectId,
    title: data.title,
    description: data.description ?? null,
    status: data.status as TaskRecord['status'],
    priority: data.priority as TaskRecord['priority'],
    wbs: data.wbs ?? null,
    createdAt: data.createdAt,
    startDate: data.startDate ?? null,
    dueDate: data.dueDate ?? null,
    completion: data.completion ?? null,
    assignee: data.assignee ?? null,
    isMilestone: data.isMilestone,
    predecessors: data.predecessors ?? [],
    updatedAt: data.updatedAt,
  }));

const projectDeleteSnapshotSchema = z
  .object({
    project: projectSnapshotSchema,
    tasks: z.array(taskSnapshotSchema).optional().default([]),
  })
  .transform((data) => ({
    project: data.project,
    tasks: data.tasks ?? [],
  }));

const parseProjectSnapshot = (payload: Record<string, unknown> | null) => {
  if (!payload) throw new RollbackError('INVALID_ROLLBACK', 'Missing project snapshot.', 400);
  const parsed = projectSnapshotSchema.safeParse(payload);
  if (!parsed.success) throw new RollbackError('INVALID_ROLLBACK', 'Invalid project snapshot.', 400);
  return parsed.data as ProjectRecord;
};

const parseProjectDeleteSnapshot = (payload: Record<string, unknown> | null) => {
  if (!payload) throw new RollbackError('INVALID_ROLLBACK', 'Missing project snapshot.', 400);
  const parsed = projectDeleteSnapshotSchema.safeParse(payload);
  if (parsed.success) return parsed.data as { project: ProjectRecord; tasks: TaskRecord[] };
  const fallback = projectSnapshotSchema.safeParse(payload);
  if (!fallback.success) throw new RollbackError('INVALID_ROLLBACK', 'Invalid project snapshot.', 400);
  return { project: fallback.data as ProjectRecord, tasks: [] };
};

const parseTaskSnapshot = (payload: Record<string, unknown> | null) => {
  if (!payload) throw new RollbackError('INVALID_ROLLBACK', 'Missing task snapshot.', 400);
  const parsed = taskSnapshotSchema.safeParse(payload);
  if (!parsed.success) throw new RollbackError('INVALID_ROLLBACK', 'Invalid task snapshot.', 400);
  return parsed.data as TaskRecord;
};

export const recordAudit = async (
  db: ReturnType<typeof import('../db').getDb>,
  entry: Omit<AuditRecord, 'id' | 'timestamp'>
): Promise<AuditRecord> => {
  const timestamp = now();
  const record: AuditRecord = {
    id: generateId(),
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
    actor: entry.actor,
    reason: entry.reason ?? null,
    timestamp,
    projectId: entry.projectId ?? null,
    taskId: entry.taskId ?? null,
    draftId: entry.draftId ?? null,
  };

  await db.insert(auditLogs).values({
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    action: record.action,
    before: record.before ? JSON.stringify(record.before) : null,
    after: record.after ? JSON.stringify(record.after) : null,
    actor: record.actor,
    reason: record.reason ?? null,
    timestamp: record.timestamp,
    projectId: record.projectId ?? null,
    taskId: record.taskId ?? null,
    draftId: record.draftId ?? null,
  });

  return record;
};

export const listAuditLogs = async (
  db: ReturnType<typeof import('../db').getDb>,
  filters: {
    projectId?: string;
    taskId?: string;
    page?: number;
    pageSize?: number;
    actor?: string;
    action?: string;
    entityType?: string;
    q?: string;
    from?: number;
    to?: number;
  }
): Promise<{ data: AuditRecord[]; total: number; page: number; pageSize: number }> => {
  const clauses = [];
  if (filters.projectId) clauses.push(eq(auditLogs.projectId, filters.projectId));
  if (filters.taskId) clauses.push(eq(auditLogs.taskId, filters.taskId));
  if (filters.actor) clauses.push(eq(auditLogs.actor, filters.actor));
  if (filters.action) clauses.push(eq(auditLogs.action, filters.action));
  if (filters.entityType) clauses.push(eq(auditLogs.entityType, filters.entityType));
  if (filters.from) clauses.push(gte(auditLogs.timestamp, filters.from));
  if (filters.to) clauses.push(lte(auditLogs.timestamp, filters.to));
  if (filters.q) {
    const q = `%${filters.q}%`;
    clauses.push(or(like(auditLogs.entityId, q), like(auditLogs.reason, q)));
  }
  const whereClause = clauses.length ? and(...clauses) : undefined;

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause);

  const rows = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.timestamp))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const data = rows.map((row) => ({
    id: row.id,
    entityType: row.entityType as AuditRecord['entityType'],
    entityId: row.entityId,
    action: row.action,
    before: safeJsonParse<Record<string, unknown> | null>(row.before, null),
    after: safeJsonParse<Record<string, unknown> | null>(row.after, null),
    actor: row.actor as AuditRecord['actor'],
    reason: row.reason,
    timestamp: row.timestamp,
    projectId: row.projectId,
    taskId: row.taskId,
    draftId: row.draftId,
  }));
  return { data, total: count, page, pageSize };
};

export const getAuditLogById = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string
): Promise<AuditRecord | null> => {
  const row = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).get();
  if (!row) return null;
  return {
    id: row.id,
    entityType: row.entityType as AuditRecord['entityType'],
    entityId: row.entityId,
    action: row.action,
    before: safeJsonParse<Record<string, unknown> | null>(row.before, null),
    after: safeJsonParse<Record<string, unknown> | null>(row.after, null),
    actor: row.actor as AuditRecord['actor'],
    reason: row.reason,
    timestamp: row.timestamp,
    projectId: row.projectId,
    taskId: row.taskId,
    draftId: row.draftId,
  };
};

export const rollbackAuditLog = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  input: { actor: AuditRecord['actor']; reason?: string }
): Promise<{ audit: AuditRecord; entity: ProjectRecord | TaskRecord | null }> => {
  const entry = await getAuditLogById(db, id);
  if (!entry) throw new RollbackError('NOT_FOUND', 'Audit log not found.', 404);
  if (entry.action === 'rollback') {
    throw new RollbackError('INVALID_ROLLBACK', 'Rollback entries cannot be rolled back.', 400);
  }

  let entity: ProjectRecord | TaskRecord | null = null;
  let beforeState: ProjectRecord | TaskRecord | null = null;
  let afterState: ProjectRecord | TaskRecord | null = null;

  if (entry.entityType === 'project') {
    const existingRow = await db.select().from(projects).where(eq(projects.id, entry.entityId)).get();
    const existing = existingRow ? toProjectRecord(existingRow) : null;

    if (entry.action === 'create') {
      if (!existing) throw new RollbackError('NOT_FOUND', 'Project not found for rollback.', 404);
      beforeState = existing;
      await db.delete(tasks).where(eq(tasks.projectId, existing.id));
      await db.delete(projects).where(eq(projects.id, existing.id));
      afterState = null;
    } else if (entry.action === 'update') {
      if (!existing) throw new RollbackError('NOT_FOUND', 'Project not found for rollback.', 404);
      const snapshot = parseProjectSnapshot(entry.before ?? null);
      beforeState = existing;
      await db
        .update(projects)
        .set({
          name: snapshot.name,
          description: snapshot.description,
          icon: snapshot.icon,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
        })
        .where(eq(projects.id, snapshot.id));
      afterState = snapshot;
      entity = snapshot;
    } else if (entry.action === 'delete') {
      const snapshot = parseProjectDeleteSnapshot(entry.before ?? null);
      beforeState = existing;
      if (existing) {
        await db
          .update(projects)
          .set({
            name: snapshot.project.name,
            description: snapshot.project.description,
            icon: snapshot.project.icon,
            createdAt: snapshot.project.createdAt,
            updatedAt: snapshot.project.updatedAt,
          })
          .where(eq(projects.id, snapshot.project.id));
      } else {
        await db.insert(projects).values({
          id: snapshot.project.id,
          name: snapshot.project.name,
          description: snapshot.project.description,
          icon: snapshot.project.icon,
          createdAt: snapshot.project.createdAt,
          updatedAt: snapshot.project.updatedAt,
        });
      }
      await db.delete(tasks).where(eq(tasks.projectId, snapshot.project.id));
      if (snapshot.tasks.length > 0) {
        for (const task of snapshot.tasks) {
          await db.insert(tasks).values({
            id: task.id,
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            wbs: task.wbs,
            createdAt: task.createdAt,
            startDate: task.startDate,
            dueDate: task.dueDate,
            completion: task.completion,
            assignee: task.assignee,
            isMilestone: toSqlBoolean(task.isMilestone),
            predecessors: JSON.stringify(task.predecessors),
            updatedAt: task.updatedAt,
          });
        }
      }
      afterState = snapshot.project;
      entity = snapshot.project;
    } else {
      throw new RollbackError('INVALID_ROLLBACK', 'Unsupported action for rollback.', 400);
    }
  } else if (entry.entityType === 'task') {
    const existingRow = await db.select().from(tasks).where(eq(tasks.id, entry.entityId)).get();
    const existing = existingRow ? toTaskRecord(existingRow) : null;

    if (entry.action === 'create') {
      if (!existing) throw new RollbackError('NOT_FOUND', 'Task not found for rollback.', 404);
      beforeState = existing;
      await db.delete(tasks).where(eq(tasks.id, existing.id));
      afterState = null;
    } else if (entry.action === 'update') {
      if (!existing) throw new RollbackError('NOT_FOUND', 'Task not found for rollback.', 404);
      const snapshot = parseTaskSnapshot(entry.before ?? null);
      const projectRow = await db.select().from(projects).where(eq(projects.id, snapshot.projectId)).get();
      if (!projectRow) throw new RollbackError('INVALID_ROLLBACK', 'Project missing for task rollback.', 409);
      beforeState = existing;
      await db
        .update(tasks)
        .set({
          projectId: snapshot.projectId,
          title: snapshot.title,
          description: snapshot.description,
          status: snapshot.status,
          priority: snapshot.priority,
          wbs: snapshot.wbs,
          createdAt: snapshot.createdAt,
          startDate: snapshot.startDate,
          dueDate: snapshot.dueDate,
          completion: snapshot.completion,
          assignee: snapshot.assignee,
          isMilestone: toSqlBoolean(snapshot.isMilestone),
          predecessors: JSON.stringify(snapshot.predecessors),
          updatedAt: snapshot.updatedAt,
        })
        .where(eq(tasks.id, snapshot.id));
      afterState = snapshot;
      entity = snapshot;
    } else if (entry.action === 'delete') {
      const snapshot = parseTaskSnapshot(entry.before ?? null);
      const projectRow = await db.select().from(projects).where(eq(projects.id, snapshot.projectId)).get();
      if (!projectRow) throw new RollbackError('INVALID_ROLLBACK', 'Project missing for task rollback.', 409);
      beforeState = existing;
      if (existing) {
        await db
          .update(tasks)
          .set({
            projectId: snapshot.projectId,
            title: snapshot.title,
            description: snapshot.description,
            status: snapshot.status,
            priority: snapshot.priority,
            wbs: snapshot.wbs,
            createdAt: snapshot.createdAt,
            startDate: snapshot.startDate,
            dueDate: snapshot.dueDate,
            completion: snapshot.completion,
            assignee: snapshot.assignee,
            isMilestone: toSqlBoolean(snapshot.isMilestone),
            predecessors: JSON.stringify(snapshot.predecessors),
            updatedAt: snapshot.updatedAt,
          })
          .where(eq(tasks.id, snapshot.id));
      } else {
        await db.insert(tasks).values({
          id: snapshot.id,
          projectId: snapshot.projectId,
          title: snapshot.title,
          description: snapshot.description,
          status: snapshot.status,
          priority: snapshot.priority,
          wbs: snapshot.wbs,
          createdAt: snapshot.createdAt,
          startDate: snapshot.startDate,
          dueDate: snapshot.dueDate,
          completion: snapshot.completion,
          assignee: snapshot.assignee,
          isMilestone: toSqlBoolean(snapshot.isMilestone),
          predecessors: JSON.stringify(snapshot.predecessors),
          updatedAt: snapshot.updatedAt,
        });
      }
      afterState = snapshot;
      entity = snapshot;
    } else {
      throw new RollbackError('INVALID_ROLLBACK', 'Unsupported action for rollback.', 400);
    }
  } else {
    throw new RollbackError('INVALID_ROLLBACK', 'Unsupported entity for rollback.', 400);
  }

  const reason = input.reason ?? `Rollback of audit ${entry.id}`;
  const audit = await recordAudit(db, {
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: 'rollback',
    before: beforeState ?? null,
    after: afterState ?? null,
    actor: input.actor,
    reason,
    projectId: entry.entityType === 'project' ? entry.entityId : (afterState as TaskRecord | null)?.projectId ?? null,
    taskId: entry.entityType === 'task' ? entry.entityId : null,
    draftId: null,
  });

  return { audit, entity };
};

export const isRollbackError = (error: unknown): error is RollbackError =>
  error instanceof RollbackError;
