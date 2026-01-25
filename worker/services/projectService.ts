import { and, eq, sql } from 'drizzle-orm';
import { projects, tasks } from '../db/schema';
import { toProjectRecord } from './serializers';
import { generateId, now } from './utils';
import type { ProjectRecord } from './types';

export const listProjects = async (
  db: ReturnType<typeof import('../db').getDb>,
  workspaceId: string
): Promise<ProjectRecord[]> => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(projects.createdAt);
  return rows.map(toProjectRecord);
};

export const getProjectById = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<ProjectRecord | null> => {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  return row ? toProjectRecord(row) : null;
};

export const createProject = async (
  db: ReturnType<typeof import('../db').getDb>,
  data: { id?: string; name: string; description?: string; icon?: string; createdAt?: number; updatedAt?: number; workspaceId: string }
): Promise<ProjectRecord> => {
  const timestamp = now();
  const createdAt = typeof data.createdAt === 'number' && !Number.isNaN(data.createdAt) ? data.createdAt : timestamp;
  const updatedAt = typeof data.updatedAt === 'number' && !Number.isNaN(data.updatedAt) ? data.updatedAt : createdAt;
  const record = {
    id: data.id ?? generateId(),
    workspaceId: data.workspaceId,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? null,
    createdAt,
    updatedAt,
  };
  await db.insert(projects).values(record);
  return record;
};

export const updateProject = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  data: { name?: string; description?: string; icon?: string },
  workspaceId: string
): Promise<ProjectRecord | null> => {
  const existingRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return null;

  const next = {
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    icon: data.icon ?? existing.icon,
    updatedAt: now(),
  };

  await db.update(projects).set(next).where(eq(projects.id, id));
  return toProjectRecord({ ...existing, ...next });
};

export const deleteProject = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<{ project: ProjectRecord | null; deletedTasks: number }> => {
  const existingRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return { project: null, deletedTasks: 0 };

  const [{ count: taskCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.projectId, id));
  await db.delete(tasks).where(eq(tasks.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  if (count === 0) {
    await db.insert(projects).values({
      id: generateId(),
      workspaceId,
      name: 'New Project',
      description: 'Auto-created project',
      icon: '🧭',
      createdAt: now(),
      updatedAt: now(),
    });
  }

  return { project: toProjectRecord(existing), deletedTasks: taskCount };
};
