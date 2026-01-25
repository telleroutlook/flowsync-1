/**
 * Domain-Agnostic AI Tool Registry
 *
 * This module provides a configuration-based system for defining and executing AI tools.
 * Tools are defined with their schemas and handlers, making it easy to extend the system
 * for new domains beyond just project/task management.
 */

import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';

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
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  handler: ToolHandler;
  category?: 'read' | 'write' | 'action';
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
    page: { type: 'number', description: 'Page number (1-indexed)' },
    pageSize: { type: 'number', description: 'Items per page' },
  },
  taskFields: {
    title: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    wbs: { type: 'string' },
    startDate: {
      type: 'number',
      description: 'Task start date as Unix timestamp in milliseconds',
    },
    dueDate: {
      type: 'number',
      description: 'Task due date as Unix timestamp in milliseconds',
    },
    completion: { type: 'number' },
    assignee: { type: 'string' },
    isMilestone: { type: 'boolean' },
    predecessors: { type: 'array', items: { type: 'string' } },
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

  getOpenAITools(): Array<{ type: 'function'; function: { name: string; description?: string; parameters: JsonSchema } }> {
    return this.getAll().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async execute(
    toolName: string,
    context: ToolHandlerContext
  ): Promise<string> {
    const tool = this.get(toolName);
    if (!tool) {
      return `Unknown tool: ${toolName}`;
    }
    try {
      return await tool.handler(context);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

// ============================================================================
// Default Tool Definitions for Project/Task Domain
// ============================================================================

function createDefaultTools(_c: Context<{ Bindings: Bindings; Variables: Variables }>): ToolDefinition[] {
  return [
    // Read-only tools
    {
      name: 'listProjects',
      description: 'List all projects with ids, names, and descriptions.',
      parameters: { type: 'object', properties: {} },
      category: 'read',
      handler: async ({ db }) => {
        const { projects } = await import('../db/schema');
        const projectRows = await db
          .select({ id: projects.id, name: projects.name, description: projects.description })
          .from(projects);
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
        const { eq } = await import('drizzle-orm');
        const id = typeof args.id === 'string' ? args.id : '';
        const projectList = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
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
          ...commonSchemas.taskFields,
          ...commonSchemas.pagination,
          projectId: commonSchemas.projectId,
          assignee: { type: 'string' },
          q: { type: 'string', description: 'Search query for title/description' },
        },
      },
      category: 'read',
      handler: async ({ db, args }) => {
        const { tasks } = await import('../db/schema');
        const { and, eq, like, or, sql } = await import('drizzle-orm');
        const { toTaskRecord } = await import('../services/serializers');

        const conditions = [];
        if (args.projectId) {
          conditions.push(eq(tasks.projectId, String(args.projectId)));
        }
        if (args.status) {
          conditions.push(eq(tasks.status, String(args.status)));
        }
        if (args.assignee) {
          conditions.push(eq(tasks.assignee, String(args.assignee)));
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
        const page = typeof args.page === 'number' ? args.page : 1;
        const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 50;
        const offset = (page - 1) * pageSize;

        const taskList = await db.select().from(tasks).where(whereClause).limit(pageSize).offset(offset);
        const totalCount = await db.select({ count: tasks.id }).from(tasks).where(whereClause);

        return JSON.stringify({
          success: true,
          data: taskList.map(toTaskRecord),
          total: totalCount.length,
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
          projectId: commonSchemas.projectId,
          q: { type: 'string', description: 'Search query for title/description' },
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
          assignee: { type: 'string' },
        },
      },
      category: 'read',
      handler: async ({ db, args }) => {
        // searchTasks is an alias to listTasks with different default behavior
        const { tasks } = await import('../db/schema');
        const { and, eq, like, or, sql } = await import('drizzle-orm');
        const { toTaskRecord } = await import('../services/serializers');

        const conditions = [];
        if (args.projectId) {
          conditions.push(eq(tasks.projectId, String(args.projectId)));
        }
        if (args.status) {
          conditions.push(eq(tasks.status, String(args.status)));
        }
        if (args.assignee) {
          conditions.push(eq(tasks.assignee, String(args.assignee)));
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
        const page = typeof args.page === 'number' ? args.page : 1;
        const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 50;
        const offset = (page - 1) * pageSize;

        const taskList = await db.select().from(tasks).where(whereClause).limit(pageSize).offset(offset);
        const totalCount = await db.select({ count: tasks.id }).from(tasks).where(whereClause);

        return JSON.stringify({
          success: true,
          data: taskList.map(toTaskRecord),
          total: totalCount.length,
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
        const { tasks } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        const { toTaskRecord } = await import('../services/serializers');
        const id = typeof args.id === 'string' ? args.id : '';
        const taskList = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
        if (taskList.length === 0) {
          return JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
        }
        return JSON.stringify({ success: true, data: toTaskRecord(taskList[0]) });
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
          title: { type: 'string' },
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
        const actions = Array.isArray(args.actions) ? args.actions : [];
        const summary = actions.map((action: any) => {
          const type = action.entityType || 'unknown';
          const op = action.action || 'unknown';
          const id = action.entityId || 'new';
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
