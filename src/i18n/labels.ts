import { Priority, TaskStatus } from '../../types';
import type { TFunction } from './types';

const statusKeyMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'status.todo',
  [TaskStatus.IN_PROGRESS]: 'status.in_progress',
  [TaskStatus.DONE]: 'status.done',
};

const priorityKeyMap: Record<Priority, string> = {
  [Priority.LOW]: 'priority.low',
  [Priority.MEDIUM]: 'priority.medium',
  [Priority.HIGH]: 'priority.high',
};

const priorityShortKeyMap: Record<Priority, string> = {
  [Priority.LOW]: 'priority.short.low',
  [Priority.MEDIUM]: 'priority.short.medium',
  [Priority.HIGH]: 'priority.short.high',
};

export const getStatusLabel = (status: TaskStatus, t: TFunction) => t(statusKeyMap[status]);

export const getPriorityLabel = (priority: Priority, t: TFunction) => t(priorityKeyMap[priority]);

export const getPriorityShortLabel = (priority: Priority, t: TFunction) => t(priorityShortKeyMap[priority]);

// Audit label helpers (consolidated from multiple components)
const actionKeyMap: Record<string, string> = {
  create: 'audit.actions.create',
  update: 'audit.actions.update',
  delete: 'audit.actions.delete',
  rollback: 'audit.actions.rollback',
};

const entityKeyMap: Record<string, string> = {
  project: 'audit.entities.project',
  task: 'audit.entities.task',
};

const actorKeyMap: Record<string, string> = {
  user: 'audit.actors.user',
  agent: 'audit.actors.agent',
  system: 'audit.actors.system',
};

export const getActionLabel = (action: string, t: TFunction) => t(actionKeyMap[action] || action);

export const getEntityLabel = (entityType: string, t: TFunction) => t(entityKeyMap[entityType] || entityType);

export const getActorLabel = (actor: string, t: TFunction) => t(actorKeyMap[actor] || actor);
