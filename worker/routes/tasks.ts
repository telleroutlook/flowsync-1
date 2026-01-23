import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import { createTask, deleteTask, getTaskById, listTasks, updateTask } from '../services/taskService';

const statusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const taskInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: statusEnum.default('TODO'),
  priority: priorityEnum.default('MEDIUM'),
  wbs: z.string().optional(),
  startDate: z.number().optional(),
  dueDate: z.number().optional(),
  completion: z.number().min(0).max(100).optional(),
  assignee: z.string().optional(),
  isMilestone: z.boolean().optional(),
  predecessors: z.array(z.string()).optional(),
});

const taskUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  wbs: z.string().optional(),
  startDate: z.number().optional(),
  dueDate: z.number().optional(),
  completion: z.number().min(0).max(100).optional(),
  assignee: z.string().optional(),
  isMilestone: z.boolean().optional(),
  predecessors: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  status: statusEnum.optional(),
  assignee: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export const tasksRoute = new Hono<{ Variables: { db: ReturnType<typeof import('../db').getDb> } }>();

tasksRoute.get('/', async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return jsonError(c, 'INVALID_QUERY', 'Invalid query parameters.', 400);
  const result = await listTasks(c.get('db'), parsed.data);
  return jsonOk(c, result);
});

tasksRoute.get('/:id', async (c) => {
  const task = await getTaskById(c.get('db'), c.req.param('id'));
  if (!task) return jsonError(c, 'NOT_FOUND', 'Task not found.', 404);
  return jsonOk(c, task);
});

tasksRoute.post('/', zValidator('json', taskInputSchema), async (c) => {
  const data = c.req.valid('json');
  const task = await createTask(c.get('db'), {
    projectId: data.projectId,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    wbs: data.wbs,
    startDate: data.startDate,
    dueDate: data.dueDate,
    completion: data.completion,
    assignee: data.assignee,
    isMilestone: data.isMilestone,
    predecessors: data.predecessors,
  });
  return jsonOk(c, task, 201);
});

tasksRoute.patch('/:id', zValidator('json', taskUpdateSchema), async (c) => {
  const data = c.req.valid('json');
  const task = await updateTask(c.get('db'), c.req.param('id'), {
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    wbs: data.wbs,
    startDate: data.startDate,
    dueDate: data.dueDate,
    completion: data.completion,
    assignee: data.assignee,
    isMilestone: data.isMilestone,
    predecessors: data.predecessors,
  });
  if (!task) return jsonError(c, 'NOT_FOUND', 'Task not found.', 404);
  return jsonOk(c, task);
});

tasksRoute.delete('/:id', async (c) => {
  const task = await deleteTask(c.get('db'), c.req.param('id'));
  if (!task) return jsonError(c, 'NOT_FOUND', 'Task not found.', 404);
  return jsonOk(c, task);
});
