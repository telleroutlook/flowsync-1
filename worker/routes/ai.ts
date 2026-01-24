import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { jsonError, jsonOk } from './helpers';
import { recordLog } from '../services/logService';
import { getAuthorizationHeader } from '../utils/bigmodelAuth';
import type { Bindings, Variables } from '../types';
import type { Context } from 'hono';
import { projects, tasks } from '../db/schema';

export const aiRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Helper function to execute read-only tool calls locally
async function executeTool(c: Context<{ Bindings: Bindings; Variables: Variables }>, toolName: string, args: Record<string, unknown>): Promise<string> {
  const db = c.get('db');

  switch (toolName) {
    case 'listProjects': {
      const projects = await db.select({ id: projects.id, name: projects.name, description: projects.description }).from(projects);
      return JSON.stringify({ success: true, data: projects });
    }

    case 'getProject': {
      const id = typeof args.id === 'string' ? args.id : '';
      const projectList = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (projectList.length === 0) return JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return JSON.stringify({ success: true, data: projectList[0] });
    }

    case 'listTasks':
    case 'searchTasks': {
      const { and, eq, like, or } = await import('drizzle-orm');
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
        conditions.push(or(
          like(tasks.title, `%${String(args.q)}%`),
          like(tasks.description || '', `%${String(args.q)}%`)
        ));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const page = typeof args.page === 'number' ? args.page : 1;
      const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 50;
      const offset = (page - 1) * pageSize;

      const taskList = await db.select().from(tasks).where(whereClause).limit(pageSize).offset(offset);
      const totalCount = await db.select({ count: tasks.id }).from(tasks).where(whereClause);

      return JSON.stringify({
        success: true,
        data: taskList,
        total: totalCount.length,
        page,
        pageSize
      });
    }

    case 'getTask': {
      const id = typeof args.id === 'string' ? args.id : '';
      const { eq } = await import('drizzle-orm');
      const taskList = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
      if (taskList.length === 0) return JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return JSON.stringify({ success: true, data: taskList[0] });
    }

    case 'createTask':
    case 'updateTask':
    case 'deleteTask':
    case 'createProject':
    case 'updateProject':
    case 'deleteProject':
    case 'planChanges':
    case 'applyChanges': {
      // These tools don't need execution here - they'll be handled by frontend
      return JSON.stringify({ status: 'pending', message: 'Tool to be executed by frontend' });
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

type JsonSchema = Record<string, unknown>;

type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: JsonSchema;
  };
};

type FunctionDeclaration = {
  name: string;
  description?: string;
  parameters: JsonSchema;
};

const listProjectsTool: FunctionDeclaration = {
  name: 'listProjects',
  description: 'List all projects with ids, names, and descriptions.',
  parameters: { type: 'object', properties: {} },
};

const getProjectTool: FunctionDeclaration = {
  name: 'getProject',
  description: 'Fetch a single project by id.',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
};

const listTasksTool: FunctionDeclaration = {
  name: 'listTasks',
  description: 'List tasks with optional filters and pagination.',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      assignee: { type: 'string' },
      q: { type: 'string' },
      page: { type: 'number' },
      pageSize: { type: 'number' },
    },
  },
};

const getTaskTool: FunctionDeclaration = {
  name: 'getTask',
  description: 'Fetch a single task by id.',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
};

const searchTasksTool: FunctionDeclaration = {
  name: 'searchTasks',
  description: 'Search tasks by keyword and optional filters.',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      q: { type: 'string' },
      status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      assignee: { type: 'string' },
    },
  },
};

const createProjectTool: FunctionDeclaration = {
  name: 'createProject',
  description: 'Create a new project. Creates a draft that requires user approval.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      reason: { type: 'string', description: 'Reason for creating this project (optional)' },
    },
    required: ['name'],
  },
};

const updateProjectTool: FunctionDeclaration = {
  name: 'updateProject',
  description: 'Update an existing project. Creates a draft that requires user approval.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      reason: { type: 'string', description: 'Reason for updating this project (optional)' },
    },
    required: ['id'],
  },
};

const deleteProjectTool: FunctionDeclaration = {
  name: 'deleteProject',
  description: 'Delete a project. Creates a draft that requires user approval.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      reason: { type: 'string', description: 'Reason for deleting this project (optional)' },
    },
    required: ['id'],
  },
};

const createTaskTool: FunctionDeclaration = {
  name: 'createTask',
  description: 'Create a NEW task. IMPORTANT: Only use this for tasks that DO NOT exist yet. If the user refers to "this task" or wants to modify an existing task, use updateTask instead. You MUST call searchTasks first to verify the task does not exist. Only projectId and title are required; other fields can be inferred from context.',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      wbs: { type: 'string' },
      startDate: { type: 'number' },
      dueDate: { type: 'number' },
      completion: { type: 'number' },
      assignee: { type: 'string' },
      isMilestone: { type: 'boolean' },
      predecessors: { type: 'array', items: { type: 'string' } },
      reason: { type: 'string', description: 'Reason for creating this task (optional)' },
    },
    required: ['projectId', 'title'],
  },
};

const updateTaskTool: FunctionDeclaration = {
  name: 'updateTask',
  description: 'Update an EXISTING task. Use this when the user refers to "this task", "the task", or wants to modify/set attributes of an existing task. Creates a draft that requires user approval.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      wbs: { type: 'string' },
      startDate: { type: 'number' },
      dueDate: { type: 'number' },
      completion: { type: 'number' },
      assignee: { type: 'string' },
      isMilestone: { type: 'boolean' },
      predecessors: { type: 'array', items: { type: 'string' } },
      reason: { type: 'string', description: 'Reason for updating this task (optional)' },
    },
    required: ['id'],
  },
};

const deleteTaskTool: FunctionDeclaration = {
  name: 'deleteTask',
  description: 'Delete a task. Creates a draft that requires user approval.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      reason: { type: 'string', description: 'Reason for deleting this task (optional)' },
    },
    required: ['id'],
  },
};

const planChangesTool: FunctionDeclaration = {
  name: 'planChanges',
  description: 'Create a draft with multiple related actions at once. Use this for making multiple changes together that should be approved as a group. Each action must specify entityType (task/project), action (create/update/delete), and for update/delete include entityId.',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      reason: { type: 'string', description: 'Reason for making these changes' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: ['task', 'project'] },
            action: { type: 'string', enum: ['create', 'update', 'delete'] },
            entityId: { type: 'string', description: 'Required for update and delete actions' },
            after: { type: 'object', description: 'The new state. Required for create and update actions' },
          },
          required: ['entityType', 'action'],
        },
      },
    },
    required: ['actions'],
  },
};

const applyChangesTool: FunctionDeclaration = {
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
};

const tools: OpenAITool[] = [
  listProjectsTool,
  getProjectTool,
  listTasksTool,
  getTaskTool,
  searchTasksTool,
  createProjectTool,
  updateProjectTool,
  deleteProjectTool,
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  planChangesTool,
  applyChangesTool,
].map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

const historySchema = z.array(
  z.object({
    role: z.enum(['user', 'model', 'system']),
    parts: z.array(
      z.object({
        text: z.string(),
      })
    ),
  })
);

const requestSchema = z.object({
  history: historySchema,
  message: z.string().min(1),
  systemContext: z.string().optional(),
});

aiRoute.post('/api/ai', zValidator('json', requestSchema), async (c) => {
  const { history, message, systemContext } = c.req.valid('json');

  console.log('[AI Route] Request received:', {
    hasHistory: history?.length,
    messageLength: message?.length,
    systemContextLength: systemContext?.length,
  });

  if (!c.env.OPENAI_API_KEY) {
    console.error('[AI Route] Missing OPENAI_API_KEY');
    return jsonError(c, 'MISSING_API_KEY', 'Missing OPENAI_API_KEY binding.', 500);
  }

  console.log('[AI Route] Environment config:', {
    hasApiKey: !!c.env.OPENAI_API_KEY,
    apiKeyPrefix: c.env.OPENAI_API_KEY?.substring(0, 10) + '...',
    baseUrl: c.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: c.env.OPENAI_MODEL || 'gpt-4',
  });

  try {
    const baseUrl = (c.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;
    const model = c.env.OPENAI_MODEL || 'gpt-4';

    console.log('[AI Route] Request config:', {
      baseUrl,
      endpoint,
      model,
    });
    const systemInstruction = `You are FlowSync AI, an expert project manager.
${systemContext || ''}

CRITICAL - Task Creation vs Update:
- BEFORE creating any task, ALWAYS call searchTasks with the task title to check if it already exists
- If the user says "这个任务" (this task), "该任务" (the task), "为...设定" (set for...), or similar wording, they are referring to an EXISTING task
- For existing tasks: use updateTask with the task id
- For truly new tasks: use createTask
- Example: "请为这个新的任务，设定合理的期间及其他数据" → this means UPDATE an existing task, NOT create a new one

IMPORTANT - How to make changes:
- NEVER call createTask without first checking if the task exists
- For ambiguous requests (e.g., "set the duration for X"), call searchTasks first
- You can call multiple tools in a single response
- Use createTask/updateTask/deleteTask for single changes, use planChanges for multiple related changes
- All changes create drafts that require user approval

Workflow:
- Understand the user's intent
- If they mention existing tasks or use demonstrative pronouns (this, that, these), call searchTasks FIRST
- Then immediately call the appropriate create/update/delete tool in the SAME response
- Always explain what you're doing

Resolve dependency conflicts and date issues automatically when planning changes.
Current Date: ${new Date().toISOString().split('T')[0]}`;

    await recordLog(c.get('db'), 'ai_request', {
      message,
      history: history.slice(-10),
    });

    let messages: Array<{ role: string; content?: string; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: 'system', content: systemInstruction },
      ...history.map((item) => ({
        role: item.role === 'model' ? 'assistant' : item.role,
        content: item.parts.map((part) => part.text).join(''),
      })),
      { role: 'user', content: message },
    ];

    // Multi-turn tool calling: keep calling AI until it stops requesting tools
    let maxTurns = 5; // Prevent infinite loops
    let currentTurn = 0;
    let finalText = '';
    let allFunctionCalls: Array<{ name: string; args: unknown }> = [];

    while (currentTurn < maxTurns) {
      currentTurn++;
      console.log('[AI Route] Turn', currentTurn, 'of', maxTurns);

      // 生成认证头（支持智谱AI JWT token）
      const authorization = getAuthorizationHeader(c.env.OPENAI_API_KEY, baseUrl);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Route] Request failed:', {
          status: response.status,
          errorBody: errorText,
        });
        return jsonError(c, 'OPENAI_ERROR', errorText || 'OpenAI request failed.', 502);
      }

      const payload: {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      } = await response.json();

      const messagePayload = payload.choices?.[0]?.message;
      if (!messagePayload) {
        return jsonError(c, 'NO_RESPONSE', 'No response from model.', 502);
      }

      const modelText = messagePayload.content || '';
      const toolCallsFromAPI = messagePayload.tool_calls || [];

      console.log('[AI Route] Turn', currentTurn, 'response:', {
        hasText: !!modelText,
        toolCallsCount: toolCallsFromAPI.length,
      });

      // Add assistant response to messages
      messages.push({
        role: 'assistant',
        content: modelText,
        tool_calls: toolCallsFromAPI.length > 0 ? toolCallsFromAPI.map(tc => ({
          id: tc.id || `call_${Date.now()}`,
          type: 'function' as const,
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '{}',
          },
        })) : undefined,
      });

      // If no tool calls, we're done
      if (toolCallsFromAPI.length === 0) {
        finalText = modelText;
        console.log('[AI Route] No more tool calls, ending loop');
        break;
      }

      // Execute tool calls and add results to messages
      for (const toolCall of toolCallsFromAPI) {
        const toolName = toolCall.function?.name;
        const toolArgs = toolCall.function?.arguments || '{}';

        console.log('[AI Route] Executing tool:', toolName);

        let toolResult: string;
        try {
          toolResult = await executeTool(c, toolName || '', JSON.parse(toolArgs));
        } catch (error) {
          toolResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id || '',
          content: toolResult,
        });

        // Also collect for final response
        const parsedArgs = JSON.parse(toolArgs);
        allFunctionCalls.push({ name: toolName || '', args: parsedArgs });
      }

      // Continue loop to get next response from AI
    }

    console.log('[AI Route] Loop completed. Total tool calls:', allFunctionCalls.length);

    await recordLog(c.get('db'), 'ai_response', {
      text: finalText,
      toolCalls: allFunctionCalls,
    });

    return jsonOk(c, {
      text: finalText,
      toolCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
    });
  } catch (error) {
    await recordLog(c.get('db'), 'error', {
      message: 'OpenAI request failed.',
      detail: error instanceof Error ? error.message : String(error),
    });
    return jsonError(c, 'OPENAI_ERROR', 'OpenAI request failed.', 502);
  }
});
