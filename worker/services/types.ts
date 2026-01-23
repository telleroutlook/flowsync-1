export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

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
};

export type DraftRecord = {
  id: string;
  projectId: string | null;
  status: 'pending' | 'applied' | 'discarded';
  actions: DraftAction[];
  createdAt: number;
  createdBy: 'user' | 'agent' | 'system';
  reason?: string | null;
};

export type AuditRecord = {
  id: string;
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
