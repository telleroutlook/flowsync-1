import type { ApiResponse, AuditLog, Draft, DraftAction, Project, Task, User, Workspace, WorkspaceJoinRequest, WorkspaceMember, WorkspaceMemberActionResult, WorkspaceMembership, WorkspaceWithMembership } from '../types';

const buildQueryString = (params: Record<string, string | number | boolean | undefined | null>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
};

const getStoredValue = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const buildHeaders = (headers?: HeadersInit) => {
  const merged = new Headers(headers || {});
  const token = getStoredValue('flowsync:authToken');
  if (token) merged.set('Authorization', `Bearer ${token}`);
  const workspaceId = getStoredValue('flowsync:activeWorkspaceId');
  if (workspaceId) merged.set('X-Workspace-Id', workspaceId);
  return merged;
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, { ...init, headers: buildHeaders(init?.headers) });
  const payload: ApiResponse<T> = await response.json();
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message || 'Request failed.');
  }
  return payload.data;
};

export const apiService = {
  register: (data: { username: string; password: string }) =>
    fetchJson<{ user: User; token: string; expiresAt: number }>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  login: (data: { username: string; password: string }) =>
    fetchJson<{ user: User; token: string; expiresAt: number }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  me: () => fetchJson<{ user: User }>('/api/auth/me'),
  logout: () =>
    fetchJson<{ success: true }>('/api/auth/logout', {
      method: 'POST',
    }),

  listWorkspaces: () => fetchJson<WorkspaceWithMembership[]>('/api/workspaces'),
  createWorkspace: (data: { name: string; description?: string }) =>
    fetchJson<Workspace>('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  requestJoinWorkspace: (id: string) =>
    fetchJson<WorkspaceMembership>(`/api/workspaces/${id}/join`, { method: 'POST' }),
  listWorkspaceRequests: (id: string) =>
    fetchJson<WorkspaceJoinRequest[]>(`/api/workspaces/${id}/requests`),
  approveWorkspaceRequest: (workspaceId: string, userId: string) =>
    fetchJson<WorkspaceMembership>(`/api/workspaces/${workspaceId}/requests/${userId}/approve`, { method: 'POST' }),
  rejectWorkspaceRequest: (workspaceId: string, userId: string) =>
    fetchJson<WorkspaceMemberActionResult>(`/api/workspaces/${workspaceId}/requests/${userId}/reject`, { method: 'POST' }),
  listWorkspaceMembers: (id: string) =>
    fetchJson<WorkspaceMember[]>(`/api/workspaces/${id}/members`),
  removeWorkspaceMember: (workspaceId: string, userId: string) =>
    fetchJson<WorkspaceMemberActionResult>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),

  listProjects: () => fetchJson<Project[]>('/api/projects'),
  getProject: (id: string) => fetchJson<Project>(`/api/projects/${id}`),
  createProject: (data: { id?: string; name: string; description?: string; icon?: string; createdAt?: number; updatedAt?: number }) =>
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
  }) => {
    return fetchJson<{ data: Task[]; total: number; page: number; pageSize: number }>(
      `/api/tasks${buildQueryString(params)}`
    );
  },
  getTask: (id: string) => fetchJson<Task>(`/api/tasks/${id}`),
  createTask: (data: {
    id?: string;
    projectId: string;
    title: string;
    description?: string;
    status?: Task['status'];
    priority?: Task['priority'];
    wbs?: string;
    startDate?: number;
    dueDate?: number;
    completion?: number;
    assignee?: string;
    isMilestone?: boolean;
    predecessors?: string[];
    createdAt?: number;
    updatedAt?: number;
  }) =>
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

  listAuditLogs: (params: {
    projectId?: string;
    taskId?: string;
    page?: number;
    pageSize?: number;
    actor?: string;
    action?: string;
    entityType?: string;
    q?: string;
    from?: number;
    to?: number;
  }) => {
    return fetchJson<{ data: AuditLog[]; total: number; page: number; pageSize: number }>(
      `/api/audit${buildQueryString(params)}`
    );
  },
  getAuditLog: (id: string) => fetchJson<AuditLog>(`/api/audit/${id}`),
};
