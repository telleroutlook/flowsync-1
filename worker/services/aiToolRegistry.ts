/**
 * Domain-Agnostic AI Tool Registry
 *
 * This module provides a configuration-based system for defining and executing AI tools.
 * Tools are defined with their schemas and handlers, making it easy to extend the system
 * for new domains beyond just project/task management.
 */

import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import { PUBLIC_WORKSPACE_ID } from './workspaceService';

// ============================================================================
// Type Definitions
// ============================================================================

export type JsonSchema = Record<string, unknown>;

export type ToolParameterSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  minimum?: number;
  maximum?: number;
};

export type ToolCategory = 'read' | 'write' | 'action';

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  handler: ToolHandler;
  category?: ToolCategory;
};

export type ToolHandler = (
  context: ToolHandlerContext
) => Promise<string> | string;

export type ToolHandlerContext = {
  db: ReturnType<typeof import('../db').getDb>;
  args: Record<string, unknown>;
  toolName: string;
};

export type ToolRegistryConfig = {
  tools: ToolDefinition[];
};

// ============================================================================
// Default Tool Schemas (reusable components)
// ============================================================================

const commonSchemas = {
  entityId: {
    type: 'string',
    description: 'The unique identifier of the entity',
  },
  projectId: {
    type: 'string',
    description: 'The project ID',
  },
  reason: {
    type: 'string',
    description: 'Reason for this change (optional)',
  },
  pagination: {
    page: { type: 'number', description: 'Page number (1-indexed)', minimum: 1 },
    pageSize: { type: 'number', description: 'Items per page', minimum: 1, maximum: 100 },
  },
  taskTitle: {
    type: 'string',
    description: 'Task title',
  },
  taskFields: {
    description: { type: 'string' },
    status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'], description: 'Task status' },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Task priority' },
    wbs: { type: 'string' },
    startDate: {
      type: 'number',
      description: 'Task start date as Unix timestamp in milliseconds',
      minimum: 0,
    },
    dueDate: {
      type: 'number',
      description: 'Task due date as Unix timestamp in milliseconds',
      minimum: 0,
    },
    completion: { type: 'number', minimum: 0, maximum: 100 },
    assignee: { type: 'string' },
    isMilestone: { type: 'boolean' },
    predecessors: { type: 'array', items: { type: 'string' } },
  },
  taskFilterFields: {
    projectId: { type: 'string', description: 'Filter by project ID' },
    status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'], description: 'Filter by status' },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Filter by priority' },
    assignee: { type: 'string', description: 'Filter by assignee' },
    isMilestone: { type: 'boolean', description: 'Filter by milestone tasks' },
    startDateFrom: {
      type: 'number',
      description: 'Filter tasks with startDate >= this Unix ms timestamp',
      minimum: 0,
    },
    startDateTo: {
      type: 'number',
      description: 'Filter tasks with startDate <= this Unix ms timestamp',
      minimum: 0,
    },
    dueDateFrom: {
      type: 'number',
      description: 'Filter tasks with dueDate >= this Unix ms timestamp',
      minimum: 0,
    },
    dueDateTo: {
      type: 'number',
      description: 'Filter tasks with dueDate <= this Unix ms timestamp',
      minimum: 0,
    },
    q: { type: 'string', description: 'Search query for title/description' },
  },
  projectFields: {
    name: { type: 'string' },
    description: { type: 'string' },
    icon: { type: 'string' },
  },
};

// ============================================================================
// Tool Registry Class
// ============================================================================

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeValue = (schema: JsonSchema | undefined, value: unknown): unknown => {
  if (!schema || !isPlainObject(schema)) return value;
  const schemaType = typeof schema.type === 'string' ? schema.type : undefined;

  if (schemaType === 'number' && typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (schemaType === 'boolean' && typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  if (schemaType === 'array' && Array.isArray(value)) {
    const itemSchema = isPlainObject(schema.items) ? schema.items : undefined;
    if (itemSchema) {
      return value.map((item) => normalizeValue(itemSchema, item));
    }
  }

  if (schemaType === 'object' && isPlainObject(value)) {
    const propertiesSchema = isPlainObject(schema.properties) ? schema.properties : undefined;
    if (!propertiesSchema) return value;
    const normalized: Record<string, unknown> = { ...value };
    for (const [key, propSchema] of Object.entries(propertiesSchema)) {
      if (key in normalized) {
        const schemaForProp = isPlainObject(propSchema) ? propSchema : undefined;
        normalized[key] = normalizeValue(schemaForProp, normalized[key]);
      }
    }
    return normalized;
  }

  return value;
};

const normalizeArgs = (schema: ToolParameterSchema, args: Record<string, unknown>): Record<string, unknown> => {
  if (schema.type !== 'object') return args;
  if (!isPlainObject(args)) return args;
  if (!isPlainObject(schema.properties)) return args;
  const normalized: Record<string, unknown> = { ...args };
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (key in normalized) {
      const schemaForProp = isPlainObject(propSchema) ? propSchema : undefined;
      normalized[key] = normalizeValue(schemaForProp, normalized[key]);
    }
  }
  return normalized;
};

const validateValueType = (schema: JsonSchema | undefined, value: unknown): boolean => {
  if (!schema || !isPlainObject(schema)) return true;
  const schemaType = typeof schema.type === 'string' ? schema.type : undefined;
  if (!schemaType) return true;

  if (schemaType === 'string') return typeof value === 'string';
  if (schemaType === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (schemaType === 'boolean') return typeof value === 'boolean';
  if (schemaType === 'array') {
    if (!Array.isArray(value)) return false;
    const itemSchema = isPlainObject(schema.items) ? schema.items : undefined;
    if (itemSchema) {
      return value.every((item) => validateValueType(itemSchema, item));
    }
    return true;
  }
  if (schemaType === 'object') return isPlainObject(value);
  return true;
};

const validateArgs = (schema: ToolParameterSchema, args: Record<string, unknown>) => {
  if (schema.type !== 'object') {
    return { ok: true as const };
  }
  if (!isPlainObject(args)) {
    return { ok: false as const, error: 'Arguments must be an object.' };
  }

  const required = schema.required || [];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      return { ok: false as const, error: `Missing required argument: ${key}` };
    }
  }

  if (isPlainObject(schema.properties)) {
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (!Object.prototype.hasOwnProperty.call(args, key)) continue;
      const value = args[key];
      const schemaForProp = isPlainObject(propertySchema) ? propertySchema : undefined;
      if (!validateValueType(schemaForProp, value)) {
        return { ok: false as const, error: `Invalid type for argument "${key}".` };
      }
      if (schemaForProp && Array.isArray(schemaForProp.enum)) {
        if (!schemaForProp.enum.includes(value)) {
          return { ok: false as const, error: `Invalid value for argument "${key}".` };
        }
      }
      if (
        schemaForProp &&
        typeof value === 'number' &&
        typeof schemaForProp.minimum === 'number' &&
        value < schemaForProp.minimum
      ) {
        return { ok: false as const, error: `Value for argument "${key}" is below minimum.` };
      }
      if (
        schemaForProp &&
        typeof value === 'number' &&
        typeof schemaForProp.maximum === 'number' &&
        value > schemaForProp.maximum
      ) {
        return { ok: false as const, error: `Value for argument "${key}" exceeds maximum.` };
      }
    }
  }

  if (typeof args.startDate === 'number' && typeof args.dueDate === 'number' && args.dueDate < args.startDate) {
    return { ok: false as const, error: 'dueDate must be greater than or equal to startDate.' };
  }

  if (
    typeof args.startDateFrom === 'number' &&
    typeof args.startDateTo === 'number' &&
    args.startDateTo < args.startDateFrom
  ) {
    return { ok: false as const, error: 'startDateTo must be greater than or equal to startDateFrom.' };
  }

  if (
    typeof args.dueDateFrom === 'number' &&
    typeof args.dueDateTo === 'number' &&
    args.dueDateTo < args.dueDateFrom
  ) {
    return { ok: false as const, error: 'dueDateTo must be greater than or equal to dueDateFrom.' };
  }

  return { ok: true as const };
};

class AIToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private toolsByCategory = new Map<string, ToolDefinition[]>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    const category = tool.category || 'action';
    if (!this.toolsByCategory.has(category)) {
      this.toolsByCategory.set(category, []);
    }
    this.toolsByCategory.get(category)?.push(tool);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): ToolDefinition[] {
    return this.toolsByCategory.get(category) || [];
  }

  getOpenAITools(options?: { categories?: ToolCategory[] }): Array<{ type: 'function'; function: { name: string; description?: string; parameters: JsonSchema } }> {
    const categories = options?.categories;
    const toolList = categories
      ? this.getAll().filter((tool) => categories.includes(tool.category || 'action'))
      : this.getAll();
    return toolList.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async execute(toolName: string, context: ToolHandlerContext): Promise<string> {
    const tool = this.get(toolName);
    if (!tool) {
      return `Unknown tool: ${toolName}`;
    }
    try {
      const normalizedArgs = normalizeArgs(tool.parameters, context.args);
      const validation = validateArgs(tool.parameters, normalizedArgs);
      if (!validation.ok) {
        return `Error: ${validation.error}`;
      }
      return await tool.handler({ ...context, args: normalizedArgs });
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

// ============================================================================
// Default Tool Definitions for Project/Task Domain
// ============================================================================

function createDefaultTools(c: Context<{ Bindings: Bindings; Variables: Variables }>): ToolDefinition[] {
  const workspaceId = c.get('workspace')?.id ?? PUBLIC_WORKSPACE_ID;
  return [
    // Read-only tools
    {
      name: 'listProjects',
      description: 'List all projects with ids, names, and descriptions.',
      parameters: { type: 'object', properties: {} },
      category: 'read',
      handler: async ({ db }) => {
        const { projects } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        const projectRows = await db
          .select({ id: projects.id, name: projects.name, description: projects.description })
          .from(projects)
          .where(eq(projects.workspaceId, workspaceId));
        return JSON.stringify({ success: true, data: projectRows });
      },
    },
    {
      name: 'getProject',
      description: 'Fetch a single project by id.',
      parameters: {
        type: 'object',
        properties: { id: commonSchemas.entityId },
        required: ['id'],
      },
      category: 'read',
      handler: async ({ db, args }) => {
        const { projects } = await import('../db/schema');
        const { and, eq } = await import('drizzle-orm');
        const id = typeof args.id === 'string' ? args.id : '';
        const projectList = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
          .limit(1);
        if (projectList.length === 0) {
          return JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
        }
        return JSON.stringify({ success: true, data: projectList[0] });
      },
    },
    {
      name: 'listTasks',
      description: 'List tasks with optional filters and pagination.',
      parameters: {
        type: 'object',
        properties: {
          ...commonSchemas.taskFilterFields,
          ...commonSchemas.pagination,
        },
      },
      category: 'read',
      handler: async ({ db, args }) => {
        const { tasks, projects } = await import('../db/schema');
        const { and, eq, gte, lte, like, or, sql } = await import('drizzle-orm');
        const { toTaskRecord } = await import('../services/serializers');

        const conditions = [];
        if (args.projectId) {
          conditions.push(eq(tasks.projectId, String(args.projectId)));
        }
        if (args.status) {
          conditions.push(eq(tasks.status, String(args.status)));
        }
        if (args.priority) {
          conditions.push(eq(tasks.priority, String(args.priority)));
        }
        if (args.assignee) {
          conditions.push(eq(tasks.assignee, String(args.assignee)));
        }
        if (typeof args.isMilestone === 'boolean') {
          conditions.push(eq(tasks.isMilestone, args.isMilestone));
        }
        if (typeof args.startDateFrom === 'number') {
          conditions.push(gte(tasks.startDate, args.startDateFrom));
        }
        if (typeof args.startDateTo === 'number') {
          conditions.push(lte(tasks.startDate, args.startDateTo));
        }
        if (typeof args.dueDateFrom === 'number') {
          conditions.push(gte(tasks.dueDate, args.dueDateFrom));
        }
        if (typeof args.dueDateTo === 'number') {
          conditions.push(lte(tasks.dueDate, args.dueDateTo));
        }
        if (args.q) {
          const query = `%${String(args.q)}%`;
          conditions.push(
            or(
              like(tasks.title, query),
              like(sql`coalesce(${tasks.description}, '')`, query)
            )
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const workspaceClause = eq(projects.workspaceId, workspaceId);
        const combinedClause = whereClause ? and(whereClause, workspaceClause) : workspaceClause;
        const page = typeof args.page === 'number' ? Math.max(1, args.page) : 1;
        const pageSize = typeof args.pageSize === 'number' ? Math.min(100, Math.max(1, args.pageSize)) : 50;
        const offset = (page - 1) * pageSize;

        const taskList = await db
          .select()
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(combinedClause)
          .limit(pageSize)
          .offset(offset);
        const totalCountRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(combinedClause);
        const totalCount = totalCountRows[0]?.count ?? 0;

        return JSON.stringify({
          success: true,
          data: taskList.map((row) => toTaskRecord(row.tasks)),
          total: totalCount,
          page,
          pageSize,
        });
      },
    },
    {
      name: 'searchTasks',
      description: 'Search tasks by keyword and optional filters.',
      parameters: {
        type: 'object',
        properties: {
          ...commonSchemas.taskFilterFields,
          ...commonSchemas.pagination,
        },
      },
      category: 'read',
      handler: async ({ db, args }) => {
        // searchTasks is an alias to listTasks with different default behavior
        const { tasks, projects } = await import('../db/schema');
        const { and, eq, gte, lte, like, or, sql } = await import('drizzle-orm');
        const { toTaskRecord } = await import('../services/serializers');

        const conditions = [];
        if (args.projectId) {
          conditions.push(eq(tasks.projectId, String(args.projectId)));
        }
        if (args.status) {
          conditions.push(eq(tasks.status, String(args.status)));
        }
        if (args.priority) {
          conditions.push(eq(tasks.priority, String(args.priority)));
        }
        if (args.assignee) {
          conditions.push(eq(tasks.assignee, String(args.assignee)));
        }
        if (typeof args.isMilestone === 'boolean') {
          conditions.push(eq(tasks.isMilestone, args.isMilestone));
        }
        if (typeof args.startDateFrom === 'number') {
          conditions.push(gte(tasks.startDate, args.startDateFrom));
        }
        if (typeof args.startDateTo === 'number') {
          conditions.push(lte(tasks.startDate, args.startDateTo));
        }
        if (typeof args.dueDateFrom === 'number') {
          conditions.push(gte(tasks.dueDate, args.dueDateFrom));
        }
        if (typeof args.dueDateTo === 'number') {
          conditions.push(lte(tasks.dueDate, args.dueDateTo));
        }
        if (args.q) {
          const query = `%${String(args.q)}%`;
          conditions.push(
            or(
              like(tasks.title, query),
              like(sql`coalesce(${tasks.description}, '')`, query)
            )
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const workspaceClause = eq(projects.workspaceId, workspaceId);
        const combinedClause = whereClause ? and(whereClause, workspaceClause) : workspaceClause;
        const page = typeof args.page === 'number' ? Math.max(1, args.page) : 1;
        const pageSize = typeof args.pageSize === 'number' ? Math.min(100, Math.max(1, args.pageSize)) : 50;
        const offset = (page - 1) * pageSize;

        const taskList = await db
          .select()
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(combinedClause)
          .limit(pageSize)
          .offset(offset);
        const totalCountRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(combinedClause);
        const totalCount = totalCountRows[0]?.count ?? 0;

        return JSON.stringify({
          success: true,
          data: taskList.map((row) => toTaskRecord(row.tasks)),
          total: totalCount,
          page,
          pageSize,
        });
      },
    },
    {
      name: 'getTask',
      description: 'Fetch a single task by id.',
      parameters: {
        type: 'object',
        properties: { id: commonSchemas.entityId },
        required: ['id'],
      },
      category: 'read',
      handler: async ({ db, args }) => {
        const { tasks, projects } = await import('../db/schema');
        const { and, eq } = await import('drizzle-orm');
        const { toTaskRecord } = await import('../services/serializers');
        const id = typeof args.id === 'string' ? args.id : '';
        const taskList = await db
          .select()
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(and(eq(tasks.id, id), eq(projects.workspaceId, workspaceId)))
          .limit(1);
        if (taskList.length === 0) {
          return JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
        }
        return JSON.stringify({ success: true, data: toTaskRecord(taskList[0].tasks) });
      },
    },

    // Write tools (create drafts)
    {
      name: 'createProject',
      description: 'Create a new project. Creates a draft that requires user approval.',
      parameters: {
        type: 'object',
        properties: {
          ...commonSchemas.projectFields,
          reason: commonSchemas.reason,
        },
        required: ['name'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = [{
          entityType: 'project' as const,
          action: 'create' as const,
          after: {
            name: args.name,
            description: args.description,
            icon: args.icon,
          },
        }];
        const summary = actions.map(a => `${a.action} ${a.entityType}`).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },
    {
      name: 'updateProject',
      description: 'Update an existing project. Creates a draft that requires user approval.',
      parameters: {
        type: 'object',
        properties: {
          id: commonSchemas.entityId,
          ...commonSchemas.projectFields,
          reason: commonSchemas.reason,
        },
        required: ['id'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = [{
          entityType: 'project' as const,
          action: 'update' as const,
          entityId: args.id as string,
          after: {
            name: args.name,
            description: args.description,
            icon: args.icon,
          },
        }];
        const summary = actions.map(a => `${a.action} ${a.entityType}(${args.id})`).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },
    {
      name: 'deleteProject',
      description: 'Delete a project. Creates a draft that requires user approval.',
      parameters: {
        type: 'object',
        properties: {
          id: commonSchemas.entityId,
          reason: commonSchemas.reason,
        },
        required: ['id'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = [{
          entityType: 'project' as const,
          action: 'delete' as const,
          entityId: args.id as string,
        }];
        const summary = actions.map(a => `${a.action} ${a.entityType}(${args.id})`).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },
    {
      name: 'createTask',
      description: 'Create a NEW task. IMPORTANT: Only use this for tasks that DO NOT exist yet. If the user refers to "this task" or wants to modify an existing task, use updateTask instead. You MUST call searchTasks first to verify the task does not exist.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            ...commonSchemas.projectId,
            description: 'The project ID for this task. Use the Active Project ID from the system context.',
          },
          title: commonSchemas.taskTitle,
          ...commonSchemas.taskFields,
          reason: commonSchemas.reason,
        },
        required: ['projectId', 'title'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = [{
          entityType: 'task' as const,
          action: 'create' as const,
          after: {
            projectId: args.projectId,
            title: args.title,
            description: args.description,
            status: args.status,
            priority: args.priority,
            wbs: args.wbs,
            startDate: args.startDate,
            dueDate: args.dueDate,
            completion: args.completion,
            assignee: args.assignee,
            isMilestone: args.isMilestone,
            predecessors: args.predecessors,
          },
        }];
        const summary = actions.map(a => `${a.action} ${a.entityType}`).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },
    {
      name: 'updateTask',
      description: 'Update an EXISTING task. Use this when the user refers to "this task", "the task", or wants to modify/set attributes of an existing task. Creates a draft that requires user approval.',
      parameters: {
        type: 'object',
        properties: {
          id: commonSchemas.entityId,
          title: commonSchemas.taskTitle,
          ...commonSchemas.taskFields,
          reason: commonSchemas.reason,
        },
        required: ['id'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = [{
          entityType: 'task' as const,
          action: 'update' as const,
          entityId: args.id as string,
          after: {
            title: args.title,
            description: args.description,
            status: args.status,
            priority: args.priority,
            wbs: args.wbs,
            startDate: args.startDate,
            dueDate: args.dueDate,
            completion: args.completion,
            assignee: args.assignee,
            isMilestone: args.isMilestone,
            predecessors: args.predecessors,
          },
        }];
        const summary = actions.map(a => `${a.action} ${a.entityType}(${args.id})`).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },
    {
      name: 'deleteTask',
      description: 'Delete a task. Creates a draft that requires user approval.',
      parameters: {
        type: 'object',
        properties: {
          id: commonSchemas.entityId,
          reason: commonSchemas.reason,
        },
        required: ['id'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = [{
          entityType: 'task' as const,
          action: 'delete' as const,
          entityId: args.id as string,
        }];
        const summary = actions.map(a => `${a.action} ${a.entityType}(${args.id})`).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },
    {
      name: 'planChanges',
      description: 'Create a draft with multiple related actions at once. Use this for making multiple changes together that should be approved as a group.',
      parameters: {
        type: 'object',
        properties: {
          projectId: commonSchemas.projectId,
          reason: commonSchemas.reason,
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                entityType: { type: 'string', enum: ['task', 'project'] },
                action: { type: 'string', enum: ['create', 'update', 'delete'] },
                entityId: {
                  type: 'string',
                  description: 'Required for update and delete actions',
                },
                after: {
                  type: 'object',
                  description: 'The new state. Required for create and update actions.',
                },
              },
              required: ['entityType', 'action'],
            },
          },
        },
        required: ['actions'],
      },
      category: 'write',
      handler: async ({ args }) => {
        const actions = Array.isArray(args.actions) ? (args.actions as Array<Record<string, unknown>>) : [];
        const summary = actions.map((action) => {
          const type = typeof action.entityType === 'string' ? action.entityType : 'unknown';
          const op = typeof action.action === 'string' ? action.action : 'unknown';
          const id = typeof action.entityId === 'string' ? action.entityId : 'new';
          return `${op} ${type}(${id})`;
        }).join(', ');
        return JSON.stringify({
          success: true,
          message: `Draft created with ${actions.length} action(s): ${summary}. Awaiting user approval.`,
          actions,
        });
      },
    },

    // Action tools
    {
      name: 'applyChanges',
      description: 'Apply a previously created draft by draftId.',
      parameters: {
        type: 'object',
        properties: {
          draftId: { type: 'string' },
          actor: { type: 'string', enum: ['user', 'agent', 'system'] },
        },
        required: ['draftId'],
      },
      category: 'action',
      handler: async () => {
        return JSON.stringify({ success: true, message: 'Draft applied successfully.' });
      },
    },
  ];
}

// ============================================================================
// Factory Function
// ============================================================================

export function createToolRegistry(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  additionalTools?: ToolDefinition[]
): AIToolRegistry {
  const registry = new AIToolRegistry();
  const defaultTools = createDefaultTools(c);
  registry.registerAll(defaultTools);
  if (additionalTools) {
    registry.registerAll(additionalTools);
  }
  return registry;
}
