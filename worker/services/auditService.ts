import { and, desc, eq } from 'drizzle-orm';
import { auditLogs } from '../db/schema';
import type { AuditRecord } from './types';
import { generateId, now, safeJsonParse } from './utils';

export const recordAudit = async (
  db: ReturnType<typeof import('../db').getDb>,
  entry: Omit<AuditRecord, 'id' | 'timestamp'>
) => {
  const timestamp = now();
  await db.insert(auditLogs).values({
    id: generateId(),
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before ? JSON.stringify(entry.before) : null,
    after: entry.after ? JSON.stringify(entry.after) : null,
    actor: entry.actor,
    reason: entry.reason ?? null,
    timestamp,
    projectId: entry.projectId ?? null,
    taskId: entry.taskId ?? null,
    draftId: entry.draftId ?? null,
  });
};

export const listAuditLogs = async (
  db: ReturnType<typeof import('../db').getDb>,
  filters: { projectId?: string; taskId?: string }
): Promise<AuditRecord[]> => {
  const clauses = [];
  if (filters.projectId) clauses.push(eq(auditLogs.projectId, filters.projectId));
  if (filters.taskId) clauses.push(eq(auditLogs.taskId, filters.taskId));

  const rows = await db
    .select()
    .from(auditLogs)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(auditLogs.timestamp));

  return rows.map((row) => ({
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
};
