export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type UserRecord = {
  id: string;
  username: string;
  createdAt: number;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  createdBy: string | null;
  isPublic: boolean;
};

export type WorkspaceMembershipRecord = {
  workspaceId: string;
  userId: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending';
  createdAt: number;
};

export type TaskRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  wbs: string | null;
  createdAt: number;
  startDate: number | null;
  dueDate: number | null;
  completion: number | null;
  assignee: string | null;
  isMilestone: boolean;
  predecessors: string[];
  updatedAt: number;
};

export type ProjectRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
};

export type DraftAction = {
  id: string;
  entityType: 'task' | 'project';
  action: 'create' | 'update' | 'delete';
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  warnings?: string[];
  explicitFields?: string[];  // Fields explicitly modified by user/AI (e.g., ['startDate', 'dueDate'])
};

export type DraftRecord = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  status: 'pending' | 'applied' | 'discarded';
  actions: DraftAction[];
  createdAt: number;
  createdBy: 'user' | 'agent' | 'system';
  reason?: string | null;
};

export type AuditRecord = {
  id: string;
  workspaceId: string;
  entityType: 'task' | 'project';
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actor: 'user' | 'agent' | 'system';
  reason?: string | null;
  timestamp: number;
  projectId?: string | null;
  taskId?: string | null;
  draftId?: string | null;
};

export type PlanResult = {
  draft: DraftRecord;
  warnings: string[];
};
