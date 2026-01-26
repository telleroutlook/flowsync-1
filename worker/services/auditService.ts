import { and, desc, eq, sql, like, or, gte, lte } from 'drizzle-orm';
import { auditLogs } from '../db/schema';
import type { AuditRecord } from './types';
import { generateId, now } from './utils';

export const recordAudit = async (
  db: ReturnType<typeof import('../db').getDb>,
  entry: Omit<AuditRecord, 'id' | 'timestamp'>
): Promise<AuditRecord> => {
  const timestamp = now();
  const record: AuditRecord = {
    id: generateId(),
    workspaceId: entry.workspaceId,
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
    workspaceId: record.workspaceId,
    entityType: record.entityType,
    entityId: record.entityId,
    action: record.action,
    before: record.before,
    after: record.after,
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
    workspaceId: string;
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
  clauses.push(eq(auditLogs.workspaceId, filters.workspaceId));
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
    workspaceId: row.workspaceId,
    entityType: row.entityType as AuditRecord['entityType'],
    entityId: row.entityId,
    action: row.action,
    before: row.before as Record<string, unknown> | null,
    after: row.after as Record<string, unknown> | null,
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
  id: string,
  workspaceId: string
): Promise<AuditRecord | null> => {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.id, id), eq(auditLogs.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    entityType: row.entityType as AuditRecord['entityType'],
    entityId: row.entityId,
    action: row.action,
    before: row.before as Record<string, unknown> | null,
    after: row.after as Record<string, unknown> | null,
    actor: row.actor as AuditRecord['actor'],
    reason: row.reason,
    timestamp: row.timestamp,
    projectId: row.projectId,
    taskId: row.taskId,
    draftId: row.draftId,
  };
};
