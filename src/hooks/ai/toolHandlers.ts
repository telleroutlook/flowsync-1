/**
 * AI Tool Handlers for Frontend
 *
 * This module contains handlers for AI tool calls that need to be executed
 * on the frontend side. It works in conjunction with the backend tool registry.
 */

import type { DraftAction } from '../../../types';
import type { ApiClient } from './types';

// Context passed to tool handlers
export interface ToolHandlerContext {
  api: ApiClient;
  activeProjectId: string;
  generateId: () => string;
  pushProcessingStep?: (step: string) => void;
}

// Result of tool execution
export interface ToolExecutionResult {
  output: string;
  draftActions?: DraftAction[];
  draftReason?: string;
  shouldRetry?: boolean;
  retryReason?: string;
}

// Map of tool names to their handlers
type ToolHandlerFunction = (
  args: Record<string, unknown>,
  context: ToolHandlerContext
) => Promise<ToolExecutionResult> | ToolExecutionResult;

const toolHandlers: Record<string, ToolHandlerFunction> = {
  // Read-only tools
  listProjects: async (_args, { api, pushProcessingStep }) => {
    pushProcessingStep?.('Reading project list');
    const list = await api.listProjects();
    const output = `Projects (${list.length}): ${list.map(p => `${p.name} (${p.id})`).join(', ')}`;
    return { output };
  },

  getProject: async (args, { api, pushProcessingStep }) => {
    if (typeof args.id !== 'string') {
      return { output: 'Error: Invalid project id' };
    }
    pushProcessingStep?.('Reading project details');
    const project = await api.getProject(args.id);
    return { output: `Project: ${project.name} (${project.id})` };
  },

  listTasks: async (args, { api, pushProcessingStep }) => {
    pushProcessingStep?.('Reading task list');
    const result = await api.listTasks({
      projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
      status: typeof args.status === 'string' ? args.status : undefined,
      assignee: typeof args.assignee === 'string' ? args.assignee : undefined,
      q: typeof args.q === 'string' ? args.q : undefined,
      page: typeof args.page === 'number' ? args.page : undefined,
      pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
    });
    const formatDate = (ts: number | null | undefined) => {
      if (!ts) return 'N/A';
      return new Date(ts).toISOString().split('T')[0];
    };
    const sample = result.data.slice(0, 5).map(task => {
      return `${task.title} (${formatDate(task.startDate)} - ${formatDate(task.dueDate)})`;
    }).join(', ');
    const output = `Tasks (${result.total}): ${sample}${result.total > 5 ? '…' : ''}`;
    return { output };
  },

  searchTasks: async (args, context) => {
    return toolHandlers.listTasks(args, context);
  },

  getTask: async (args, { api, pushProcessingStep }) => {
    if (typeof args.id !== 'string') {
      return { output: 'Error: Invalid task id' };
    }
    pushProcessingStep?.('Reading task details');
    const task = await api.getTask(args.id);
    const formatDate = (ts: number | null | undefined) => {
      if (!ts) return 'N/A';
      return new Date(ts).toISOString().split('T')[0];
    };
    const output = `Task: ${task.title} (ID: ${task.id}, Start: ${formatDate(task.startDate)}, Due: ${formatDate(task.dueDate)}, Status: ${task.status})`;
    return { output };
  },

  // Write tools - return draft actions instead of executing directly
  createProject: (args, { activeProjectId, generateId }) => {
    const draftActions: DraftAction[] = [{
      id: generateId(),
      entityType: 'project',
      action: 'create',
      after: {
        name: args.name,
        description: args.description,
        icon: args.icon,
      },
    }];
    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  updateProject: (args, { generateId }) => {
    const draftActions: DraftAction[] = [{
      id: generateId(),
      entityType: 'project',
      action: 'update',
      entityId: args.id as string | undefined,
      after: {
        name: args.name,
        description: args.description,
        icon: args.icon,
      },
    }];
    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  deleteProject: (args, { generateId }) => {
    const draftActions: DraftAction[] = [{
      id: generateId(),
      entityType: 'project',
      action: 'delete',
      entityId: args.id as string | undefined,
    }];
    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  createTask: (args, { activeProjectId, generateId }) => {
    const draftActions: DraftAction[] = [{
      id: generateId(),
      entityType: 'task',
      action: 'create',
      after: {
        projectId: (args.projectId as string) || activeProjectId,
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
    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  updateTask: (args, { generateId }) => {
    const draftActions: DraftAction[] = [{
      id: generateId(),
      entityType: 'task',
      action: 'update',
      entityId: args.id as string | undefined,
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
    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  deleteTask: (args, { generateId }) => {
    const draftActions: DraftAction[] = [{
      id: generateId(),
      entityType: 'task',
      action: 'delete',
      entityId: args.id as string | undefined,
    }];
    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  // planChanges is special - handles multiple actions at once
  planChanges: (args, { activeProjectId, generateId }) => {
    if (!Array.isArray(args.actions)) {
      return { output: 'Error: actions must be an array' };
    }

    const draftActions: DraftAction[] = args.actions
      .map((action: any) => {
        if (!action || typeof action !== 'object') {
          return null;
        }

        const processedAfter = { ...(action.after || {}) };
        if (action.entityType === 'task' && action.action === 'create' && !processedAfter.projectId) {
          processedAfter.projectId = activeProjectId;
        }

        return {
          id: action.id || generateId(),
          entityType: action.entityType,
          action: action.action,
          entityId: action.entityId,
          after: processedAfter,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (draftActions.length === 0) {
      return {
        output: 'No valid actions provided',
        shouldRetry: true,
        retryReason: 'The planChanges call contained no valid actions. Please verify task IDs and criteria, then ensure you populate the actions array correctly.',
      };
    }

    return {
      output: '',
      draftActions,
      draftReason: typeof args.reason === 'string' ? args.reason : undefined,
    };
  },

  // Action tools
  applyChanges: async (args, { api, pushProcessingStep }) => {
    if (typeof args.draftId !== 'string') {
      return { output: 'Error: Invalid draft id' };
    }
    pushProcessingStep?.('Applying draft');
    await api.applyDraft(args.draftId, 'user');
    return { output: `Applied draft ${args.draftId}.` };
  },
};

/**
 * Execute a tool call on the frontend
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionResult> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return { output: `Unknown tool: ${toolName}` };
  }
  try {
    return await handler(args, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { output: `Error: ${errorMessage}` };
  }
}

/**
 * Process all tool calls from an AI response
 */
export async function processToolCalls(
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>,
  context: ToolHandlerContext
): Promise<{
  outputs: string[];
  draftActions: DraftAction[];
  draftReason: string | undefined;
  shouldRetry: boolean;
  retryReason: string;
}> {
  const outputs: string[] = [];
  const allDraftActions: DraftAction[] = [];
  let draftReason: string | undefined;
  let shouldRetry = false;
  let retryReason = '';

  for (const call of toolCalls) {
    const result = await executeToolCall(call.name, call.args, context);
    outputs.push(result.output);
    allDraftActions.push(...(result.draftActions || []));
    if (result.draftReason) {
      draftReason = result.draftReason;
    }
    if (result.shouldRetry) {
      shouldRetry = true;
      retryReason = result.retryReason || '';
    }
  }

  return {
    outputs,
    draftActions: allDraftActions,
    draftReason,
    shouldRetry,
    retryReason,
  };
}

export const READ_ONLY_TOOLS = new Set([
  'listProjects',
  'getProject',
  'listTasks',
  'searchTasks',
  'getTask',
]);
