import { sql } from 'drizzle-orm';
import { projects, tasks } from '../db/schema';
import { seedProjects, seedTasks } from '../db/seed';
import { now } from './utils';
import { ensurePublicWorkspace } from './workspaceService';

export const ensureSeedData = async (db: ReturnType<typeof import('../db').getDb>) => {
  const publicWorkspace = await ensurePublicWorkspace(db);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(projects);
  if (count > 0) return;

  const timestamp = now();
  await db.insert(projects).values(
    seedProjects.map((project) => ({
      id: project.id,
      workspaceId: publicWorkspace.id,
      name: project.name,
      description: project.description ?? null,
      icon: project.icon ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
  );

  await db.insert(tasks).values(
    seedTasks.map((task) => ({
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      wbs: task.wbs ?? null,
      createdAt: task.createdAt,
      startDate: task.startDate ?? null,
      dueDate: task.dueDate ?? null,
      completion: task.completion ?? null,
      assignee: task.assignee ?? null,
      isMilestone: task.isMilestone ?? false,
      predecessors: task.predecessors ?? [],
      updatedAt: task.createdAt,
    }))
  );
};
