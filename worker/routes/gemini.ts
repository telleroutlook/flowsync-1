import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { jsonError, jsonOk } from './helpers';
import { recordLog } from '../services/logService';

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
  description: 'Create a new project (draft-first).',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['name'],
  },
};

const updateProjectTool: FunctionDeclaration = {
  name: 'updateProject',
  description: 'Update an existing project by id (draft-first).',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['id'],
  },
};

const deleteProjectTool: FunctionDeclaration = {
  name: 'deleteProject',
  description: 'Delete a project by id (draft-first).',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['id'],
  },
};

const createTaskTool: FunctionDeclaration = {
  name: 'createTask',
  description: 'Create a new task (draft-first).',
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
      reason: { type: 'string' },
    },
    required: ['projectId', 'title'],
  },
};

const updateTaskTool: FunctionDeclaration = {
  name: 'updateTask',
  description: 'Update a task by id (draft-first).',
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
      reason: { type: 'string' },
    },
    required: ['id'],
  },
};

const deleteTaskTool: FunctionDeclaration = {
  name: 'deleteTask',
  description: 'Delete a task by id (draft-first).',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['id'],
  },
};

const planChangesTool: FunctionDeclaration = {
  name: 'planChanges',
  description: 'Create a draft plan consisting of multiple actions before applying changes.',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      reason: { type: 'string' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: ['task', 'project'] },
            action: { type: 'string', enum: ['create', 'update', 'delete'] },
            entityId: { type: 'string' },
            after: { type: 'object' },
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

export const geminiRoute = new Hono<{
  Bindings: { OPENAI_API_KEY: string; OPENAI_BASE_URL?: string; OPENAI_MODEL?: string };
  Variables: { db: ReturnType<typeof import('../db').getDb> };
}>();

geminiRoute.post('/api/ai', zValidator('json', requestSchema), async (c) => {
  const { history, message, systemContext } = c.req.valid('json');

  if (!c.env.OPENAI_API_KEY) {
    return jsonError(c, 'MISSING_API_KEY', 'Missing OPENAI_API_KEY binding.', 500);
  }

  try {
    const baseUrl = (c.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions').replace(/\/+$/, '');
    const model = c.env.OPENAI_MODEL || 'GLM-4.7';
    const systemInstruction = `You are FlowSync AI, an expert project manager.\n${systemContext || ''}\nYou must read before you write: call listProjects/listTasks/searchTasks first.\nAll edits must go through planChanges and require user approval before applyChanges.\nResolve dependency conflicts and date issues automatically when planning.\nCurrent Date: ${new Date().toISOString().split('T')[0]}`;

    await recordLog(c.get('db'), 'gemini_request', {
      message,
      history: history.slice(-10),
    });

    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map((item) => ({
        role: item.role === 'model' ? 'assistant' : item.role,
        content: item.parts.map((part) => part.text).join(''),
      })),
      { role: 'user', content: message },
    ];

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
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
      return jsonError(c, 'OPENAI_ERROR', errorText || 'OpenAI request failed.', 502);
    }

    const payload: {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
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
    const functionCalls = (messagePayload.tool_calls || [])
      .map((call) => {
        const name = call.function?.name;
        const rawArgs = call.function?.arguments;
        if (!name) return null;
        if (!rawArgs) return { name, args: {} };
        try {
          return { name, args: JSON.parse(rawArgs) as unknown };
        } catch {
          return { name, args: rawArgs };
        }
      })
      .filter((call): call is { name: string; args: unknown } => Boolean(call));

    await recordLog(c.get('db'), 'gemini_response', {
      text: modelText,
      toolCalls: functionCalls,
    });

    return jsonOk(c, {
      text: modelText,
      toolCalls: functionCalls.length > 0 ? functionCalls : undefined,
    });
  } catch (error) {
    await recordLog(c.get('db'), 'error', {
      message: 'OpenAI request failed.',
      detail: error instanceof Error ? error.message : String(error),
    });
    return jsonError(c, 'OPENAI_ERROR', 'OpenAI request failed.', 502);
  }
});
