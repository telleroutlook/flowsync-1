import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  wbs: text('wbs'),
  createdAt: integer('created_at').notNull(),
  startDate: integer('start_date'),
  dueDate: integer('due_date'),
  completion: integer('completion'),
  assignee: text('assignee'),
  isMilestone: integer('is_milestone').notNull().default(0),
  predecessors: text('predecessors'),
  updatedAt: integer('updated_at').notNull(),
});

export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  status: text('status').notNull(),
  actions: text('actions').notNull(),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  reason: text('reason'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  before: text('before'),
  after: text('after'),
  actor: text('actor').notNull(),
  reason: text('reason'),
  timestamp: integer('timestamp').notNull(),
  projectId: text('project_id'),
  taskId: text('task_id'),
  draftId: text('draft_id'),
});

export const observabilityLogs = sqliteTable('observability_logs', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
});
