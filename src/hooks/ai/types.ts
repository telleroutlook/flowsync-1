/**
 * Types for AI hooks and tool handlers
 */

import type { DraftAction, Project, Task } from '../../../types';

export interface ApiClient {
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  listTasks(params: {
    projectId?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    isMilestone?: boolean;
    q?: string;
    startDateFrom?: number;
    startDateTo?: number;
    dueDateFrom?: number;
    dueDateTo?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Task[]; total: number; page: number; pageSize: number }>;
  getTask(id: string): Promise<Task>;
  createDraft(data: {
    projectId?: string;
    createdBy: 'user' | 'agent' | 'system';
    reason?: string;
    actions: DraftAction[];
  }): Promise<{ draft: { id: string }; warnings: string[] }>;
  applyDraft(draftId: string, actor: 'user' | 'agent' | 'system'): Promise<{ draft: { id: string } }>;
}

export interface ProcessingStep {
  label: string;
  elapsedMs?: number;
}

export type AiMessagePart = {
  text: string;
};

export type AiHistoryItem = {
  role: 'user' | 'model';
  parts: AiMessagePart[];
};

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AiResponse {
  text: string;
  toolCalls?: ToolCall[];
}
