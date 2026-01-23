import { pgTable, text, bigint, boolean, jsonb } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
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
  projectId: text('project_id'),
  status: text('status').notNull(),
  actions: jsonb('actions').notNull().$type<any[]>(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  createdBy: text('created_by').notNull(),
  reason: text('reason'),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
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
