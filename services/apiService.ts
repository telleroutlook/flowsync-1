import type { ApiResponse, AuditLog, Draft, DraftAction, Project, Task } from '../types';

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload: ApiResponse<T> = await response.json();
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message || 'Request failed.');
  }
  return payload.data;
};

export const apiService = {
  listProjects: () => fetchJson<Project[]>('/api/projects'),
  getProject: (id: string) => fetchJson<Project>(`/api/projects/${id}`),
  createProject: (data: { name: string; description?: string; icon?: string }) =>
    fetchJson<Project>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: { name?: string; description?: string; icon?: string }) =>
    fetchJson<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    fetchJson<{ project: Project; deletedTasks: number }>(`/api/projects/${id}`, {
      method: 'DELETE',
    }),

  listTasks: (params: {
    projectId?: string;
    status?: string;
    assignee?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    });
    const suffix = query.toString();
    return fetchJson<{ data: Task[]; total: number; page: number; pageSize: number }>(
      `/api/tasks${suffix ? `?${suffix}` : ''}`
    );
  },
  getTask: (id: string) => fetchJson<Task>(`/api/tasks/${id}`),
  createTask: (data: Omit<Task, 'id' | 'createdAt'> & { projectId: string; title: string }) =>
    fetchJson<Task>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, data: Partial<Task>) =>
    fetchJson<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteTask: (id: string) =>
    fetchJson<Task>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  listDrafts: () => fetchJson<Draft[]>('/api/drafts'),
  getDraft: (id: string) => fetchJson<Draft>(`/api/drafts/${id}`),
  createDraft: (data: { projectId?: string; createdBy?: Draft['createdBy']; reason?: string; actions: DraftAction[] }) =>
    fetchJson<{ draft: Draft; warnings: string[] }>('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  applyDraft: (id: string, actor: Draft['createdBy']) =>
    fetchJson<{ draft: Draft; results: DraftAction[] }>(`/api/drafts/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor }),
    }),
  discardDraft: (id: string) =>
    fetchJson<Draft>(`/api/drafts/${id}/discard`, {
      method: 'POST',
    }),

  listAuditLogs: (params: { projectId?: string; taskId?: string }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString();
    return fetchJson<AuditLog[]>(`/api/audit${suffix ? `?${suffix}` : ''}`);
  },
};
