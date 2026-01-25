import { eq } from 'drizzle-orm';
import { drafts, projects, tasks } from '../db/schema';
import { toProjectRecord, toTaskRecord } from './serializers';
import { applyTaskConstraints } from './constraintService';
import { recordAudit } from './auditService';
import { createProject, updateProject, deleteProject, getProjectById } from './projectService';
import { createTask, updateTask, deleteTask, getTaskById } from './taskService';
import { generateId, now } from './utils';
import type { DraftAction, DraftRecord, PlanResult, TaskRecord, ProjectRecord, TaskStatus, Priority } from './types';

const toTaskStatus = (value: unknown, fallback: TaskStatus): TaskStatus => {
  if (value === 'TODO' || value === 'IN_PROGRESS' || value === 'DONE') return value;
  return fallback;
};

const toPriority = (value: unknown, fallback: Priority): Priority => {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') return value;
  return fallback;
};

const toOptionalTaskStatus = (value: unknown): TaskStatus | undefined => {
  if (value === 'TODO' || value === 'IN_PROGRESS' || value === 'DONE') return value;
  return undefined;
};

const toOptionalPriority = (value: unknown): Priority | undefined => {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') return value;
  return undefined;
};

const parseDraftRow = (row: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  status: string;
  actions: any[];
  createdAt: number;
  createdBy: string;
  reason: string | null;
}): DraftRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  projectId: row.projectId,
  status: row.status as DraftRecord['status'],
  actions: row.actions as DraftAction[],
  createdAt: row.createdAt,
  createdBy: row.createdBy as DraftRecord['createdBy'],
  reason: row.reason,
});

const normalizeTaskInput = (
  input: Record<string, unknown>,
  fallback: TaskRecord | null,
  projectIdOverride?: string
): TaskRecord => {
  const timestamp = now();
  const projectId = (input.projectId as string | undefined) ?? projectIdOverride ?? fallback?.projectId ?? '';
  const status = toTaskStatus(input.status, fallback?.status ?? 'TODO');
  const priority = toPriority(input.priority, fallback?.priority ?? 'MEDIUM');
  const createdAt = (input.createdAt as number | undefined) ?? fallback?.createdAt ?? timestamp;
  const updatedAt = (input.updatedAt as number | undefined) ?? timestamp;
  const startDate = (input.startDate as number | undefined) ?? fallback?.startDate ?? createdAt;
  const dueDate = (input.dueDate as number | undefined) ?? fallback?.dueDate ?? null;
  const completion = (input.completion as number | undefined) ?? fallback?.completion ?? 0;
  const predecessors = (input.predecessors as string[] | undefined) ?? fallback?.predecessors ?? [];

  return {
    id: (input.id as string | undefined) ?? fallback?.id ?? generateId(),
    projectId,
    title: (input.title as string | undefined) ?? fallback?.title ?? 'Untitled Task',
    description: (input.description as string | undefined) ?? fallback?.description ?? null,
    status: status as TaskRecord['status'],
    priority: priority as TaskRecord['priority'],
    wbs: (input.wbs as string | undefined) ?? fallback?.wbs ?? null,
    createdAt,
    startDate,
    dueDate,
    completion,
    assignee: (input.assignee as string | undefined) ?? fallback?.assignee ?? null,
    isMilestone: (input.isMilestone as boolean | undefined) ?? fallback?.isMilestone ?? false,
    predecessors,
    updatedAt,
  };
};

const normalizeProjectInput = (
  input: Record<string, unknown>,
  fallback: ProjectRecord | null,
  workspaceId: string
): ProjectRecord => {
  const timestamp = now();
  const resolvedWorkspaceId = fallback?.workspaceId ?? workspaceId;
  const createdAt = (input.createdAt as number | undefined) ?? fallback?.createdAt ?? timestamp;
  const updatedAt = (input.updatedAt as number | undefined) ?? timestamp;
  return {
    id: (input.id as string | undefined) ?? fallback?.id ?? generateId(),
    workspaceId: resolvedWorkspaceId,
    name: (input.name as string | undefined) ?? fallback?.name ?? 'Untitled Project',
    description: (input.description as string | undefined) ?? fallback?.description ?? null,
    icon: (input.icon as string | undefined) ?? fallback?.icon ?? null,
    createdAt,
    updatedAt,
  };
};

const planActions = async (
  db: ReturnType<typeof import('../db').getDb>,
  actions: DraftAction[],
  workspaceId: string
) => {
  const planned: DraftAction[] = [];
  const warnings: string[] = [];

  // Extract IDs that we need to fetch
  const projectIdsToFetch = new Set<string>();
  const taskIdsToFetch = new Set<string>();
  const projectIdsReferenced = new Set<string>();

  for (const action of actions) {
    if (action.entityType === 'project') {
      if (action.action !== 'create') {
        projectIdsToFetch.add(action.entityId || '');
      }
    } else if (action.entityType === 'task') {
      if (action.action !== 'create') {
        taskIdsToFetch.add(action.entityId || '');
      }
      // Collect project IDs from task actions
      const projectId = (action.after as Record<string, unknown> | undefined)?.projectId as string | undefined;
      if (projectId) projectIdsReferenced.add(projectId);
    }
  }

  // Fetch only the projects we need
  let projectState: ProjectRecord[] = [];
  if (projectIdsToFetch.size > 0 || projectIdsReferenced.size > 0) {
    const { and, inArray, or } = await import('drizzle-orm');
    const conditions = [];
    if (projectIdsToFetch.size > 0) {
      conditions.push(inArray(projects.id, Array.from(projectIdsToFetch).filter(Boolean)));
    }
    if (projectIdsReferenced.size > 0) {
      conditions.push(inArray(projects.id, Array.from(projectIdsReferenced).filter(Boolean)));
    }
    const targetClause = conditions.length > 1 ? or(...conditions) : conditions[0];
    const whereClause = targetClause ? and(eq(projects.workspaceId, workspaceId), targetClause) : eq(projects.workspaceId, workspaceId);
    const projectRows = await db.select().from(projects).where(whereClause);
    projectState = projectRows.map(toProjectRecord);
  }

  // For tasks, we need to fetch:
  // 1. Tasks being modified
  // 2. Tasks that are predecessors of tasks being modified (for constraint validation)
  // Optimization: For small drafts, load all. For large drafts, load selectively.
  const SELECTIVE_LOAD_THRESHOLD = 50;
  let taskState: TaskRecord[] = [];

  if (taskIdsToFetch.size === 0 && actions.every(a => a.entityType !== 'task' || a.action === 'create')) {
    // No existing tasks to fetch - only new tasks being created
    taskState = [];
  } else if (taskIdsToFetch.size > SELECTIVE_LOAD_THRESHOLD) {
    // Large draft - fetch all tasks (more efficient than many individual queries)
    const taskRows = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(projects.workspaceId, workspaceId));
    taskState = taskRows.map((row) => toTaskRecord(row.tasks));
  } else {
    // Small draft - fetch selectively
    const { and, inArray, or } = await import('drizzle-orm');
    const conditions = [];

    // Tasks being directly modified
    if (taskIdsToFetch.size > 0) {
      const validIds = Array.from(taskIdsToFetch).filter(Boolean);
      if (validIds.length > 0) {
        conditions.push(inArray(tasks.id, validIds));
      }
    }

    // Tasks in the same projects (for predecessor constraint validation)
    if (projectIdsReferenced.size > 0) {
      const validProjectIds = Array.from(projectIdsReferenced).filter(Boolean);
      if (validProjectIds.length > 0) {
        conditions.push(inArray(tasks.projectId, validProjectIds));
      }
    }

    const taskFilter = conditions.length === 0 ? undefined : (conditions.length === 1 ? conditions[0] : or(...conditions));
    const combinedClause = taskFilter ? and(taskFilter, eq(projects.workspaceId, workspaceId)) : eq(projects.workspaceId, workspaceId);
    const taskRows = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(combinedClause);
    taskState = taskRows.map((row) => toTaskRecord(row.tasks));
  }

  for (const action of actions) {
    if (action.entityType === 'project') {
      if (action.action === 'create') {
        const project = normalizeProjectInput(action.after ?? {}, null, workspaceId);
        projectState = [...projectState, project];
        planned.push({
          ...action,
          id: action.id || generateId(),
          entityId: project.id,
          before: null,
          after: project,
        });
      } else if (action.action === 'update') {
        const existing = projectState.find((item) => item.id === action.entityId);
        if (!existing) {
          planned.push({
            ...action,
            id: action.id || generateId(),
            before: null,
            after: null,
            warnings: ['Project not found for update.'],
          });
          warnings.push('Project not found for update.');
          continue;
        }
        const updated = normalizeProjectInput(action.after ?? {}, existing, workspaceId);
        projectState = projectState.map((item) => (item.id === existing.id ? updated : item));
        planned.push({
          ...action,
          id: action.id || generateId(),
          entityId: existing.id,
          before: existing,
          after: updated,
        });
      } else if (action.action === 'delete') {
        const existing = projectState.find((item) => item.id === action.entityId);
        if (!existing) {
          planned.push({
            ...action,
            id: action.id || generateId(),
            before: null,
            after: null,
            warnings: ['Project not found for delete.'],
          });
          warnings.push('Project not found for delete.');
          continue;
        }
        projectState = projectState.filter((item) => item.id !== existing.id);
        taskState = taskState.filter((task) => task.projectId !== existing.id);
        planned.push({
          ...action,
          id: action.id || generateId(),
          entityId: existing.id,
          before: existing,
          after: null,
        });
      }
      continue;
    }

    if (action.entityType === 'task') {
      if (action.action === 'create') {
        const projectIdOverride = (action.after as Record<string, unknown> | undefined)?.projectId as string | undefined;
        const task = normalizeTaskInput(action.after ?? {}, null, projectIdOverride);
        const constraintResult = applyTaskConstraints(task, [...taskState, task]);
        const updatedTask = constraintResult.task;
        if (!updatedTask.projectId) {
          constraintResult.warnings.push('Task create missing projectId.');
        }
        taskState = [...taskState, updatedTask];
        if (constraintResult.warnings.length) warnings.push(...constraintResult.warnings);
        planned.push({
          ...action,
          id: action.id || generateId(),
          entityId: updatedTask.id,
          before: null,
          after: updatedTask,
          warnings: constraintResult.warnings.length ? constraintResult.warnings : undefined,
        });
        continue;
      }

      const existing = taskState.find((item) => item.id === action.entityId);
      if (!existing) {
        planned.push({
          ...action,
          id: action.id || generateId(),
          before: null,
          after: null,
          warnings: ['Task not found.'],
        });
        warnings.push('Task not found.');
        continue;
      }

      if (action.action === 'update') {
        const merged = normalizeTaskInput(action.after ?? {}, existing, existing.projectId);

        // Detect which fields were explicitly modified
        const explicitFields: string[] = [];
        const afterObj = action.after ?? {};
        if (afterObj.startDate !== undefined && afterObj.startDate !== existing.startDate) {
          explicitFields.push('startDate');
        }
        if (afterObj.dueDate !== undefined && afterObj.dueDate !== existing.dueDate) {
          explicitFields.push('dueDate');
        }
        if (afterObj.title !== undefined && afterObj.title !== existing.title) {
          explicitFields.push('title');
        }
        if (afterObj.status !== undefined && afterObj.status !== existing.status) {
          explicitFields.push('status');
        }
        if (afterObj.priority !== undefined && afterObj.priority !== existing.priority) {
          explicitFields.push('priority');
        }
        if (afterObj.assignee !== undefined && afterObj.assignee !== existing.assignee) {
          explicitFields.push('assignee');
        }

        // Check if dates were explicitly modified
        const datesModified = explicitFields.includes('startDate') || explicitFields.includes('dueDate');

        // First, check what the constraints would require
        const constraintResult = applyTaskConstraints(merged, taskState.map((item) => (item.id === existing.id ? merged : item)));

        // If dates were modified and constraints would change them, it's a violation
        if (datesModified && constraintResult.changed) {
          const originalStart = existing.startDate;
          const originalDue = existing.dueDate;
          const constrainedStart = constraintResult.task.startDate;
          const constrainedDue = constraintResult.task.dueDate;

          // Check if the constrained dates differ from the user's requested dates
          const startViolated = explicitFields.includes('startDate') && constrainedStart !== merged.startDate;
          const dueViolated = explicitFields.includes('dueDate') && constrainedDue !== merged.dueDate;

          if (startViolated || dueViolated) {
            // Throw an error to prevent draft creation
            const errorMessage = [
      `Cannot modify task dates: ${startViolated ? 'Start Date' : ''}${startViolated && dueViolated ? ' and ' : ''}${dueViolated ? 'Due Date' : ''} violate predecessor constraints`,
      `Task "${existing.title}" has mandatory predecessors.`,
      `Requested dates: ${merged.startDate ? new Date(merged.startDate).toISOString().split('T')[0] : 'N/A'} - ${merged.dueDate ? new Date(merged.dueDate).toISOString().split('T')[0] : 'N/A'}`,
      `Constraint dates: ${constrainedStart ? new Date(constrainedStart).toISOString().split('T')[0] : 'N/A'} - ${constrainedDue ? new Date(constrainedDue).toISOString().split('T')[0] : 'N/A'}`,
      `Please modify the predecessor task or remove the dependency.`
            ].join('\n');

            throw new Error(errorMessage);
          }
        }

        // If no violation, apply the constraints and proceed
        taskState = taskState.map((item) => (item.id === existing.id ? constraintResult.task : item));
        if (constraintResult.warnings.length) warnings.push(...constraintResult.warnings);
        planned.push({
          ...action,
          id: action.id || generateId(),
          entityId: existing.id,
          before: existing,
          after: constraintResult.task,
          warnings: constraintResult.warnings.length ? constraintResult.warnings : undefined,
        });
        continue;
      }

      if (action.action === 'delete') {
        taskState = taskState.filter((item) => item.id !== existing.id);
        planned.push({
          ...action,
          id: action.id || generateId(),
          entityId: existing.id,
          before: existing,
          after: null,
        });
      }
    }
  }

  return { actions: planned, warnings };
};

export const createDraft = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: {
    actions: DraftAction[];
    createdBy: DraftRecord['createdBy'];
    reason?: string;
    projectId?: string | null;
    workspaceId: string;
  }
): Promise<PlanResult> => {
  const { actions, warnings } = await planActions(db, input.actions, input.workspaceId);
  const draft: DraftRecord = {
    id: generateId(),
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    status: 'pending',
    actions,
    createdAt: now(),
    createdBy: input.createdBy,
    reason: input.reason ?? null,
  };

  await db.insert(drafts).values({
    id: draft.id,
    workspaceId: draft.workspaceId,
    projectId: draft.projectId,
    status: draft.status,
    actions: draft.actions,
    createdAt: draft.createdAt,
    createdBy: draft.createdBy,
    reason: draft.reason,
  });

  return { draft, warnings };
};

export const getDraftById = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<DraftRecord | null> => {
  const { and } = await import('drizzle-orm');
  const rows = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, id), eq(drafts.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  return row ? parseDraftRow(row) : null;
};

export const listDrafts = async (
  db: ReturnType<typeof import('../db').getDb>,
  workspaceId: string
): Promise<DraftRecord[]> => {
  const rows = await db
    .select()
    .from(drafts)
    .where(eq(drafts.workspaceId, workspaceId))
    .orderBy(drafts.createdAt);
  return rows.map(parseDraftRow);
};

export const discardDraft = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<DraftRecord | null> => {
  const draft = await getDraftById(db, id, workspaceId);
  if (!draft) return null;
  await db.update(drafts).set({ status: 'discarded' }).where(eq(drafts.id, id));
  return { ...draft, status: 'discarded' };
};

export const applyDraft = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  actor: DraftRecord['createdBy'],
  workspaceId: string
): Promise<{ draft: DraftRecord; results: DraftAction[] }> => {
  const draft = await getDraftById(db, id, workspaceId);
  if (!draft) {
    throw new Error('Draft not found.');
  }
  if (draft.status !== 'pending') {
    return { draft, results: draft.actions };
  }

  const results: DraftAction[] = [];

  for (const action of draft.actions) {
      if (action.entityType === 'project') {
      if (action.action === 'create' && action.after) {
        const created = await createProject(db, {
          id: (action.after.id as string) ?? undefined,
          name: (action.after.name as string) ?? 'Untitled Project',
          description: (action.after.description as string) ?? undefined,
          icon: (action.after.icon as string) ?? undefined,
          createdAt: (action.after.createdAt as number) ?? undefined,
          updatedAt: (action.after.updatedAt as number) ?? undefined,
          workspaceId,
        });
        results.push({ ...action, entityId: created.id, after: created });
        await recordAudit(db, {
          workspaceId,
          entityType: 'project',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
          actor,
          reason: draft.reason ?? null,
          projectId: created.id,
          taskId: null,
          draftId: draft.id,
        });
      } else if (action.action === 'update' && action.entityId) {
        const before = await getProjectById(db, action.entityId, workspaceId);
        const updated = await updateProject(db, action.entityId, {
          name: (action.after?.name as string) ?? undefined,
          description: (action.after?.description as string) ?? undefined,
          icon: (action.after?.icon as string) ?? undefined,
        }, workspaceId);
        if (updated) {
          results.push({ ...action, before: before ?? undefined, after: updated });
          await recordAudit(db, {
            workspaceId,
            entityType: 'project',
            entityId: updated.id,
            action: 'update',
            before: before ?? null,
            after: updated,
            actor,
            reason: draft.reason ?? null,
            projectId: updated.id,
            taskId: null,
            draftId: draft.id,
          });
        }
      } else if (action.action === 'delete' && action.entityId) {
        const before = await getProjectById(db, action.entityId, workspaceId);
        const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, action.entityId));
        const tasksBefore = taskRows.map(toTaskRecord);
        const deleted = await deleteProject(db, action.entityId, workspaceId);
        results.push({ ...action, before: before ?? undefined, after: null });
        if (deleted.project) {
          await recordAudit(db, {
            workspaceId,
            entityType: 'project',
            entityId: deleted.project.id,
            action: 'delete',
            before: { project: before ?? deleted.project, tasks: tasksBefore },
            after: null,
            actor,
            reason: draft.reason ?? null,
            projectId: deleted.project.id,
            taskId: null,
            draftId: draft.id,
          });
        }
      }
      continue;
    }

    if (action.entityType === 'task') {
      if (action.action === 'create' && action.after) {
        const created = await createTask(db, {
          id: (action.after.id as string) ?? undefined,
          projectId: (action.after.projectId as string) ?? '',
          title: (action.after.title as string) ?? 'Untitled Task',
          description: (action.after.description as string) ?? undefined,
          status: toTaskStatus(action.after.status, 'TODO'),
          priority: toPriority(action.after.priority, 'MEDIUM'),
          wbs: (action.after.wbs as string) ?? undefined,
          startDate: (action.after.startDate as number) ?? undefined,
          dueDate: (action.after.dueDate as number) ?? undefined,
          completion: (action.after.completion as number) ?? undefined,
          assignee: (action.after.assignee as string) ?? undefined,
          isMilestone: (action.after.isMilestone as boolean) ?? undefined,
          predecessors: (action.after.predecessors as string[]) ?? undefined,
          createdAt: (action.after.createdAt as number) ?? undefined,
          updatedAt: (action.after.updatedAt as number) ?? undefined,
        }, workspaceId);
        if (!created) {
          throw new Error('Invalid project for task creation.');
        }
        results.push({ ...action, entityId: created.id, after: created });
        await recordAudit(db, {
          workspaceId,
          entityType: 'task',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
          actor,
          reason: draft.reason ?? null,
          projectId: created.projectId,
          taskId: created.id,
          draftId: draft.id,
        });
      } else if (action.action === 'update' && action.entityId) {
        const before = await getTaskById(db, action.entityId, workspaceId);

        if (!before) {
          throw new Error(`Task not found: ${action.entityId}. The task may have been deleted or the draft is outdated.`);
        }

        if (!action.after) {
          throw new Error(`Invalid draft: No update data provided for task ${action.entityId}. This draft may be corrupted.`);
        }

        const updated = await updateTask(db, action.entityId, {
          title: (action.after?.title as string) ?? undefined,
          description: (action.after?.description as string) ?? undefined,
          status: toOptionalTaskStatus(action.after?.status),
          priority: toOptionalPriority(action.after?.priority),
          wbs: (action.after?.wbs as string) ?? undefined,
          startDate: (action.after?.startDate as number) ?? undefined,
          dueDate: (action.after?.dueDate as number) ?? undefined,
          completion: (action.after?.completion as number) ?? undefined,
          assignee: (action.after?.assignee as string) ?? undefined,
          isMilestone: (action.after?.isMilestone as boolean) ?? undefined,
          predecessors: (action.after?.predecessors as string[]) ?? undefined,
        }, workspaceId);
        if (updated) {
          results.push({ ...action, before: before ?? undefined, after: updated });
          await recordAudit(db, {
            workspaceId,
            entityType: 'task',
            entityId: updated.id,
            action: 'update',
            before: before ?? null,
            after: updated,
            actor,
            reason: draft.reason ?? null,
            projectId: updated.projectId,
            taskId: updated.id,
            draftId: draft.id,
          });
        }
      } else if (action.action === 'delete' && action.entityId) {
        const before = await getTaskById(db, action.entityId, workspaceId);
        const deleted = await deleteTask(db, action.entityId, workspaceId);
        results.push({ ...action, before: before ?? undefined, after: null });
        if (deleted) {
          await recordAudit(db, {
            workspaceId,
            entityType: 'task',
            entityId: deleted.id,
            action: 'delete',
            before: before ?? null,
            after: null,
            actor,
            reason: draft.reason ?? null,
            projectId: deleted.projectId,
            taskId: deleted.id,
            draftId: draft.id,
          });
        }
      }
    }
  }

  await db.update(drafts).set({ status: 'applied' }).where(eq(drafts.id, draft.id));
  return { draft: { ...draft, status: 'applied' }, results };
};

export const refreshDraftActions = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string,
  workspaceId: string
): Promise<DraftRecord | null> => {
  const draft = await getDraftById(db, id, workspaceId);
  if (!draft) return null;
  const planned = await planActions(db, draft.actions, workspaceId);
  const next = { ...draft, actions: planned.actions };
  await db.update(drafts).set({ actions: next.actions }).where(eq(drafts.id, id));
  return next;
};
