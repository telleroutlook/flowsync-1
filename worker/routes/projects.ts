import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import { createProject, deleteProject, getProjectById, listProjects, updateProject } from '../services/projectService';

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

export const projectsRoute = new Hono<{ Variables: { db: ReturnType<typeof import('../db').getDb> } }>();

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
  return jsonOk(c, project, 201);
});

projectsRoute.patch('/:id', zValidator('json', projectUpdateSchema), async (c) => {
  const data = c.req.valid('json');
  const project = await updateProject(c.get('db'), c.req.param('id'), {
    name: data.name,
    description: data.description,
    icon: data.icon,
  });
  if (!project) return jsonError(c, 'NOT_FOUND', 'Project not found.', 404);
  return jsonOk(c, project);
});

projectsRoute.delete('/:id', async (c) => {
  const result = await deleteProject(c.get('db'), c.req.param('id'));
  if (!result.project) return jsonError(c, 'NOT_FOUND', 'Project not found.', 404);
  return jsonOk(c, result);
});
