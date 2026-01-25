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
