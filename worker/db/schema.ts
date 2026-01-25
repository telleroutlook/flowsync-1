import { pgTable, text, bigint, boolean, jsonb, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_unique').on(table.username),
}));

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
}));

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  createdBy: text('created_by'),
  isPublic: boolean('is_public').notNull().default(false),
});

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: text('workspace_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
}));

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  wbs: text('wbs'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  startDate: bigint('start_date', { mode: 'number' }),
  dueDate: bigint('due_date', { mode: 'number' }),
  completion: bigint('completion', { mode: 'number' }),
  assignee: text('assignee'),
  isMilestone: boolean('is_milestone').notNull().default(false),
  predecessors: jsonb('predecessors').$type<string[]>(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const drafts = pgTable('drafts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id'),
  status: text('status').notNull(),
  actions: jsonb('actions').notNull().$type<any[]>(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  createdBy: text('created_by').notNull(),
  reason: text('reason'),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  before: jsonb('before').$type<Record<string, unknown> | null>(),
  after: jsonb('after').$type<Record<string, unknown> | null>(),
  actor: text('actor').notNull(),
  reason: text('reason'),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  projectId: text('project_id'),
  taskId: text('task_id'),
  draftId: text('draft_id'),
});

export const observabilityLogs = pgTable('observability_logs', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});
