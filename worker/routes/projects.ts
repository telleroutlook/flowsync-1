import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { jsonError, jsonOk } from './helpers';
import { createProject, deleteProject, getProjectById, listProjects, updateProject } from '../services/projectService';
import { recordAudit } from '../services/auditService';
import { tasks } from '../db/schema';
import { toTaskRecord } from '../services/serializers';
import type { Variables } from '../types';

export const projectsRoute = new Hono<{ Variables: Variables }>();

const projectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
});

const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

projectsRoute.get('/', async (c) => {
  const projects = await listProjects(c.get('db'));
  return jsonOk(c, projects);
});

projectsRoute.get('/:id', async (c) => {
  const project = await getProjectById(c.get('db'), c.req.param('id'));
  if (!project) return jsonError(c, 'NOT_FOUND', 'Project not found.', 404);
  return jsonOk(c, project);
});

projectsRoute.post('/', zValidator('json', projectInputSchema), async (c) => {
  const data = c.req.valid('json');
  const project = await createProject(c.get('db'), {
    name: data.name,
    description: data.description,
    icon: data.icon,
  });
  await recordAudit(c.get('db'), {
    entityType: 'project',
    entityId: project.id,
    action: 'create',
    before: null,
    after: project,
    actor: 'user',
    reason: null,
    projectId: project.id,
    taskId: null,
    draftId: null,
  });
  return jsonOk(c, project, 201);
});

projectsRoute.patch('/:id', zValidator('json', projectUpdateSchema), async (c) => {
  const id = c.req.param('id');
  const before = await getProjectById(c.get('db'), id);
  const data = c.req.valid('json');
  const project = await updateProject(c.get('db'), id, {
    name: data.name,
    description: data.description,
    icon: data.icon,
  });
  if (!project) return jsonError(c, 'NOT_FOUND', 'Project not found.', 404);
  await recordAudit(c.get('db'), {
    entityType: 'project',
    entityId: project.id,
    action: 'update',
    before,
    after: project,
    actor: 'user',
    reason: null,
    projectId: project.id,
    taskId: null,
    draftId: null,
  });
  return jsonOk(c, project);
});

projectsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const before = await getProjectById(c.get('db'), id);
  if (!before) return jsonError(c, 'NOT_FOUND', 'Project not found.', 404);
  const taskRows = await c.get('db').select().from(tasks).where(eq(tasks.projectId, id));
  const tasksBefore = taskRows.map(toTaskRecord);
  const result = await deleteProject(c.get('db'), id);
  if (!result.project) return jsonError(c, 'NOT_FOUND', 'Project not found.', 404);
  await recordAudit(c.get('db'), {
    entityType: 'project',
    entityId: result.project.id,
    action: 'delete',
    before: { project: before, tasks: tasksBefore },
    after: null,
    actor: 'user',
    reason: null,
    projectId: result.project.id,
    taskId: null,
    draftId: null,
  });
  return jsonOk(c, result);
});
