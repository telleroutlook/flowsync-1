import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GoogleGenAI, Type, FunctionDeclaration, Tool } from '@google/genai';

const manageTasksTool: FunctionDeclaration = {
  name: 'manageTasks',
  description:
    'Create, update, move, or delete tasks. Supports advanced project management fields like WBS, Start Dates, Progress, and Assignees.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ['create', 'move', 'delete', 'update'],
        description: 'The action to perform on a task.',
      },
      title: {
        type: Type.STRING,
        description: 'The title of the task. Required for creation.',
      },
      id: {
        type: Type.STRING,
        description: 'Optional task ID for precise updates or deletes.',
      },
      description: {
        type: Type.STRING,
        description: 'A brief description of the task.',
      },
      status: {
        type: Type.STRING,
        enum: ['todo', 'in-progress', 'done'],
        description: 'The column/status the task belongs to.',
      },
      priority: {
        type: Type.STRING,
        enum: ['low', 'medium', 'high'],
        description: 'The priority level of the task.',
      },
      oldTitle: {
        type: Type.STRING,
        description: 'The current title of the task if trying to find it to move or update.',
      },
      projectId: {
        type: Type.STRING,
        description: 'Optional project ID to scope the task operation.',
      },
      startDate: {
        type: Type.STRING,
        description: 'Planned start date (ISO 8601 or natural language).',
      },
      dueDate: {
        type: Type.STRING,
        description: 'Planned finish date / Due date (ISO 8601 or natural language).',
      },
      completion: {
        type: Type.NUMBER,
        description: 'Percentage complete (0-100).',
      },
      assignee: {
        type: Type.STRING,
        description: "Responsible unit or person (e.g., 'Construction Unit', 'Design Institute').",
      },
      wbs: {
        type: Type.STRING,
        description: "WBS Code (e.g., '1.1', '2.3').",
      },
      isMilestone: {
        type: Type.BOOLEAN,
        description: 'True if this task is a milestone (0 duration significant event).',
      },
    },
    required: ['action'],
  },
};

const manageProjectsTool: FunctionDeclaration = {
  name: 'manageProjects',
  description:
    "Create, select (switch to), update, or delete entire projects. Use this when the user mentions a 'Project' explicitly.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ['create', 'select', 'delete', 'update'],
        description: 'The action to perform on a project.',
      },
      name: {
        type: Type.STRING,
        description: 'The name of the project.',
      },
      description: {
        type: Type.STRING,
        description: 'Description of the project.',
      },
      oldName: {
        type: Type.STRING,
        description: 'The current name of the project if renaming or selecting.',
      },
    },
    required: ['action'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [manageTasksTool, manageProjectsTool] }];

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

type Bindings = {
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/api/gemini', zValidator('json', requestSchema), async (c) => {
  const { history, message, systemContext } = c.req.valid('json');

  if (!c.env.GEMINI_API_KEY) {
    return c.json(
      { success: false, error: { code: 'MISSING_API_KEY', message: 'Missing GEMINI_API_KEY binding.' } },
      500
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    const systemInstruction = `You are FlowSync AI, an expert project manager.
${systemContext || ''}
You manage projects with professional detail (WBS, Gantt schedules, Responsibility).
Current Date: ${new Date().toISOString().split('T')[0]}`;

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
      return c.json(
        { success: false, error: { code: 'NO_RESPONSE', message: 'No response from model.' } },
        502
      );
    }

    const modelText = candidate.content?.parts?.find((p) => p.text)?.text || '';
    const parts = candidate.content?.parts || [];
    const functionCalls = parts
      .filter((part) => part.functionCall)
      .map((part) => ({
        name: part.functionCall!.name,
        args: part.functionCall!.args,
      }));

    return c.json({
      success: true,
      data: {
        text: modelText,
        toolCalls: functionCalls.length > 0 ? functionCalls : undefined,
      },
    });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return c.json(
      { success: false, error: { code: 'GEMINI_ERROR', message: 'Gemini request failed.' } },
      502
    );
  }
});

export default app;
