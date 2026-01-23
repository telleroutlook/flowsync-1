import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GoogleGenAI, Type, Tool, FunctionDeclaration } from '@google/genai';
import { jsonError, jsonOk } from './helpers';
import { recordLog } from '../services/logService';

const listProjectsTool: FunctionDeclaration = {
  name: 'listProjects',
  description: 'List all projects with ids, names, and descriptions.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const getProjectTool: FunctionDeclaration = {
  name: 'getProject',
  description: 'Fetch a single project by id.',
  parameters: {
    type: Type.OBJECT,
    properties: { id: { type: Type.STRING } },
    required: ['id'],
  },
};

const listTasksTool: FunctionDeclaration = {
  name: 'listTasks',
  description: 'List tasks with optional filters and pagination.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectId: { type: Type.STRING },
      status: { type: Type.STRING, enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      assignee: { type: Type.STRING },
      q: { type: Type.STRING },
      page: { type: Type.NUMBER },
      pageSize: { type: Type.NUMBER },
    },
  },
};

const getTaskTool: FunctionDeclaration = {
  name: 'getTask',
  description: 'Fetch a single task by id.',
  parameters: {
    type: Type.OBJECT,
    properties: { id: { type: Type.STRING } },
    required: ['id'],
  },
};

const searchTasksTool: FunctionDeclaration = {
  name: 'searchTasks',
  description: 'Search tasks by keyword and optional filters.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectId: { type: Type.STRING },
      q: { type: Type.STRING },
      status: { type: Type.STRING, enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      assignee: { type: Type.STRING },
    },
  },
};

const createProjectTool: FunctionDeclaration = {
  name: 'createProject',
  description: 'Create a new project (draft-first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      description: { type: Type.STRING },
      icon: { type: Type.STRING },
      reason: { type: Type.STRING },
    },
    required: ['name'],
  },
};

const updateProjectTool: FunctionDeclaration = {
  name: 'updateProject',
  description: 'Update an existing project by id (draft-first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      name: { type: Type.STRING },
      description: { type: Type.STRING },
      icon: { type: Type.STRING },
      reason: { type: Type.STRING },
    },
    required: ['id'],
  },
};

const deleteProjectTool: FunctionDeclaration = {
  name: 'deleteProject',
  description: 'Delete a project by id (draft-first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      reason: { type: Type.STRING },
    },
    required: ['id'],
  },
};

const createTaskTool: FunctionDeclaration = {
  name: 'createTask',
  description: 'Create a new task (draft-first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectId: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      status: { type: Type.STRING, enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      priority: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
      wbs: { type: Type.STRING },
      startDate: { type: Type.NUMBER },
      dueDate: { type: Type.NUMBER },
      completion: { type: Type.NUMBER },
      assignee: { type: Type.STRING },
      isMilestone: { type: Type.BOOLEAN },
      predecessors: { type: Type.ARRAY, items: { type: Type.STRING } },
      reason: { type: Type.STRING },
    },
    required: ['projectId', 'title'],
  },
};

const updateTaskTool: FunctionDeclaration = {
  name: 'updateTask',
  description: 'Update a task by id (draft-first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      status: { type: Type.STRING, enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      priority: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
      wbs: { type: Type.STRING },
      startDate: { type: Type.NUMBER },
      dueDate: { type: Type.NUMBER },
      completion: { type: Type.NUMBER },
      assignee: { type: Type.STRING },
      isMilestone: { type: Type.BOOLEAN },
      predecessors: { type: Type.ARRAY, items: { type: Type.STRING } },
      reason: { type: Type.STRING },
    },
    required: ['id'],
  },
};

const deleteTaskTool: FunctionDeclaration = {
  name: 'deleteTask',
  description: 'Delete a task by id (draft-first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      reason: { type: Type.STRING },
    },
    required: ['id'],
  },
};

const planChangesTool: FunctionDeclaration = {
  name: 'planChanges',
  description: 'Create a draft plan consisting of multiple actions before applying changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectId: { type: Type.STRING },
      reason: { type: Type.STRING },
      actions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            entityType: { type: Type.STRING, enum: ['task', 'project'] },
            action: { type: Type.STRING, enum: ['create', 'update', 'delete'] },
            entityId: { type: Type.STRING },
            after: { type: Type.OBJECT },
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
    type: Type.OBJECT,
    properties: {
      draftId: { type: Type.STRING },
      actor: { type: Type.STRING, enum: ['user', 'agent', 'system'] },
    },
    required: ['draftId'],
  },
};

const tools: Tool[] = [
  {
    functionDeclarations: [
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
    ],
  },
];

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
  Bindings: { GEMINI_API_KEY: string };
  Variables: { db: ReturnType<typeof import('../db').getDb> };
}>();

geminiRoute.post('/api/gemini', zValidator('json', requestSchema), async (c) => {
  const { history, message, systemContext } = c.req.valid('json');

  if (!c.env.GEMINI_API_KEY) {
    return jsonError(c, 'MISSING_API_KEY', 'Missing GEMINI_API_KEY binding.', 500);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    const systemInstruction = `You are FlowSync AI, an expert project manager.\n${systemContext || ''}\nYou must read before you write: call listProjects/listTasks/searchTasks first.\nAll edits must go through planChanges and require user approval before applyChanges.\nResolve dependency conflicts and date issues automatically when planning.\nCurrent Date: ${new Date().toISOString().split('T')[0]}`;

    await recordLog(c.get('db'), 'gemini_request', {
      message,
      history: history.slice(-10),
    });

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction,
        tools,
        temperature: 0.5,
      },
      history: history.map((h) => ({
        role: h.role,
        parts: h.parts,
      })),
    });

    const result = await chat.sendMessage({ message });
    const candidate = result.candidates?.[0];

    if (!candidate) {
      return jsonError(c, 'NO_RESPONSE', 'No response from model.', 502);
    }

    const modelText = candidate.content?.parts?.find((p) => p.text)?.text || '';
    const parts = candidate.content?.parts || [];
    const functionCalls = parts
      .filter((part) => part.functionCall)
      .map((part) => ({
        name: part.functionCall!.name,
        args: part.functionCall!.args,
      }));

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
      message: 'Gemini request failed.',
      detail: error instanceof Error ? error.message : String(error),
    });
    return jsonError(c, 'GEMINI_ERROR', 'Gemini request failed.', 502);
  }
});
