import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import { workspaceMiddleware } from './middleware';
import { createTask, deleteTask, getTaskById, listTasks, updateTask } from '../services/taskService';
import { recordAudit } from '../services/auditService';
import type { Variables } from '../types';

export const tasksRoute = new Hono<{ Variables: Variables }>();
tasksRoute.use('*', workspaceMiddleware);

const statusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const booleanQuery = z.preprocess((value) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}, z.boolean());

const taskInputSchema = z.object({
  id: z.string().optional(),
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
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
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
  priority: priorityEnum.optional(),
  assignee: z.string().optional(),
  isMilestone: booleanQuery.optional(),
  q: z.string().optional(),
  startDateFrom: z.coerce.number().optional(),
  startDateTo: z.coerce.number().optional(),
  dueDateFrom: z.coerce.number().optional(),
  dueDateTo: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

tasksRoute.get('/', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return jsonError(c, 'INVALID_QUERY', 'Invalid query parameters.', 400);
  const result = await listTasks(c.get('db'), parsed.data, workspace.id);
  return jsonOk(c, result);
});

tasksRoute.get('/:id', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const task = await getTaskById(c.get('db'), c.req.param('id'), workspace.id);
  if (!task) return jsonError(c, 'NOT_FOUND', 'Task not found.', 404);
  return jsonOk(c, task);
});

tasksRoute.post('/', zValidator('json', taskInputSchema), async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const data = c.req.valid('json');
  const task = await createTask(c.get('db'), {
    id: data.id,
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
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }, workspace.id);
  if (!task) return jsonError(c, 'INVALID_PROJECT', 'Project not found in workspace.', 404);
  await recordAudit(c.get('db'), {
    workspaceId: workspace.id,
    entityType: 'task',
    entityId: task.id,
    action: 'create',
    before: null,
    after: task,
    actor: 'user',
    reason: null,
    projectId: task.projectId,
    taskId: task.id,
    draftId: null,
  });
  return jsonOk(c, task, 201);
});

tasksRoute.patch('/:id', zValidator('json', taskUpdateSchema), async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const id = c.req.param('id');
  const before = await getTaskById(c.get('db'), id, workspace.id);
  const data = c.req.valid('json');
  const task = await updateTask(c.get('db'), id, {
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
  }, workspace.id);
  if (!task) return jsonError(c, 'NOT_FOUND', 'Task not found.', 404);
  await recordAudit(c.get('db'), {
    workspaceId: workspace.id,
    entityType: 'task',
    entityId: task.id,
    action: 'update',
    before,
    after: task,
    actor: 'user',
    reason: null,
    projectId: task.projectId,
    taskId: task.id,
    draftId: null,
  });
  return jsonOk(c, task);
});

tasksRoute.delete('/:id', async (c) => {
  const workspace = c.get('workspace');
  if (!workspace) return jsonError(c, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 404);
  const id = c.req.param('id');
  const before = await getTaskById(c.get('db'), id, workspace.id);
  const task = await deleteTask(c.get('db'), id, workspace.id);
  if (!task) return jsonError(c, 'NOT_FOUND', 'Task not found.', 404);
  await recordAudit(c.get('db'), {
    workspaceId: workspace.id,
    entityType: 'task',
    entityId: task.id,
    action: 'delete',
    before: before ?? task,
    after: null,
    actor: 'user',
    reason: null,
    projectId: task.projectId,
    taskId: task.id,
    draftId: null,
  });
  return jsonOk(c, task);
});
