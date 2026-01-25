import { and, eq } from 'drizzle-orm';
import { users, workspaces, workspaceMembers } from '../db/schema';
import { generateId, now } from './utils';
import type { WorkspaceMembershipRecord, WorkspaceRecord } from './types';

export const PUBLIC_WORKSPACE_ID = 'public';

export type WorkspaceWithMembership = WorkspaceRecord & {
  membership: WorkspaceMembershipRecord | null;
};

export type WorkspaceRequestRecord = {
  userId: string;
  username: string;
  role: WorkspaceMembershipRecord['role'];
  status: WorkspaceMembershipRecord['status'];
  createdAt: number;
};

export type WorkspaceMemberRecord = {
  userId: string;
  username: string;
  role: WorkspaceMembershipRecord['role'];
  status: WorkspaceMembershipRecord['status'];
  createdAt: number;
};

export const ensurePublicWorkspace = async (
  db: ReturnType<typeof import('../db').getDb>
): Promise<WorkspaceRecord> => {
  const existing = await getWorkspaceById(db, PUBLIC_WORKSPACE_ID);
  if (existing) return existing;
  const record: WorkspaceRecord = {
    id: PUBLIC_WORKSPACE_ID,
    name: 'Public Workspace',
    description: 'Default workspace for guests',
    createdAt: now(),
    createdBy: null,
    isPublic: true,
  };
  await db.insert(workspaces).values(record);
  return record;
};

export const getWorkspaceById = async (
  db: ReturnType<typeof import('../db').getDb>,
  id: string
): Promise<WorkspaceRecord | null> => {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    isPublic: row.isPublic,
  };
};

export const listPublicWorkspaces = async (
  db: ReturnType<typeof import('../db').getDb>
): Promise<WorkspaceWithMembership[]> => {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.isPublic, true))
    .orderBy(workspaces.createdAt);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    isPublic: row.isPublic,
    membership: null,
  }));
};

export const listWorkspacesForUser = async (
  db: ReturnType<typeof import('../db').getDb>,
  userId: string
): Promise<WorkspaceWithMembership[]> => {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      createdAt: workspaces.createdAt,
      createdBy: workspaces.createdBy,
      isPublic: workspaces.isPublic,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      memberCreatedAt: workspaceMembers.createdAt,
    })
    .from(workspaces)
    .leftJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId))
    )
    .orderBy(workspaces.createdAt);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    isPublic: row.isPublic,
    membership: row.role && row.status && row.memberCreatedAt
      ? {
          workspaceId: row.id,
          userId,
          role: row.role as WorkspaceMembershipRecord['role'],
          status: row.status as WorkspaceMembershipRecord['status'],
          createdAt: row.memberCreatedAt,
        }
      : null,
  }));
};

export const getWorkspaceMembership = async (
  db: ReturnType<typeof import('../db').getDb>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceMembershipRecord | null> => {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role as WorkspaceMembershipRecord['role'],
    status: row.status as WorkspaceMembershipRecord['status'],
    createdAt: row.createdAt,
  };
};

export const createWorkspace = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: { name: string; description?: string; createdBy: string }
): Promise<WorkspaceRecord> => {
  const record: WorkspaceRecord = {
    id: generateId(),
    name: input.name,
    description: input.description ?? null,
    createdAt: now(),
    createdBy: input.createdBy,
    isPublic: false,
  };
  await db.insert(workspaces).values(record);
  await db.insert(workspaceMembers).values({
    workspaceId: record.id,
    userId: input.createdBy,
    role: 'admin',
    status: 'active',
    createdAt: record.createdAt,
  });
  return record;
};

export const requestJoinWorkspace = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: { workspaceId: string; userId: string }
): Promise<WorkspaceMembershipRecord> => {
  const workspace = await getWorkspaceById(db, input.workspaceId);
  if (!workspace) throw new Error('Workspace not found.');

  const existing = await getWorkspaceMembership(db, input.workspaceId, input.userId);
  if (existing) return existing;

  const status = workspace.isPublic ? 'active' : 'pending';
  const role: WorkspaceMembershipRecord['role'] = 'member';
  const record: WorkspaceMembershipRecord = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    role,
    status,
    createdAt: now(),
  };
  await db.insert(workspaceMembers).values({
    workspaceId: record.workspaceId,
    userId: record.userId,
    role: record.role,
    status: record.status,
    createdAt: record.createdAt,
  });
  return record;
};

export const listWorkspaceRequests = async (
  db: ReturnType<typeof import('../db').getDb>,
  workspaceId: string
): Promise<WorkspaceRequestRecord[]> => {
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      createdAt: workspaceMembers.createdAt,
      username: users.username,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.status, 'pending')))
    .orderBy(workspaceMembers.createdAt);

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    role: row.role as WorkspaceMembershipRecord['role'],
    status: row.status as WorkspaceMembershipRecord['status'],
    createdAt: row.createdAt,
  }));
};

export const listWorkspaceMembers = async (
  db: ReturnType<typeof import('../db').getDb>,
  workspaceId: string
): Promise<WorkspaceMemberRecord[]> => {
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      createdAt: workspaceMembers.createdAt,
      username: users.username,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.status, 'active')))
    .orderBy(workspaceMembers.createdAt);

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    role: row.role as WorkspaceMembershipRecord['role'],
    status: row.status as WorkspaceMembershipRecord['status'],
    createdAt: row.createdAt,
  }));
};

export const approveWorkspaceRequest = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: { workspaceId: string; userId: string; approverId: string }
): Promise<WorkspaceMembershipRecord> => {
  const approver = await getWorkspaceMembership(db, input.workspaceId, input.approverId);
  if (!approver || approver.status !== 'active' || approver.role !== 'admin') {
    throw new Error('Not authorized to approve requests.');
  }

  const membership = await getWorkspaceMembership(db, input.workspaceId, input.userId);
  if (!membership) throw new Error('Join request not found.');
  if (membership.status === 'active') return membership;

  await db
    .update(workspaceMembers)
    .set({ status: 'active' })
    .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId)));

  return { ...membership, status: 'active' };
};

export const rejectWorkspaceRequest = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: { workspaceId: string; userId: string; approverId: string }
): Promise<{ workspaceId: string; userId: string }> => {
  const approver = await getWorkspaceMembership(db, input.workspaceId, input.approverId);
  if (!approver || approver.status !== 'active' || approver.role !== 'admin') {
    throw new Error('Not authorized to reject requests.');
  }

  const membership = await getWorkspaceMembership(db, input.workspaceId, input.userId);
  if (!membership) throw new Error('Join request not found.');
  if (membership.status !== 'pending') throw new Error('Only pending requests can be rejected.');

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId)));

  return { workspaceId: input.workspaceId, userId: input.userId };
};

export const removeWorkspaceMember = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: { workspaceId: string; userId: string; removerId: string }
): Promise<{ workspaceId: string; userId: string }> => {
  const remover = await getWorkspaceMembership(db, input.workspaceId, input.removerId);
  if (!remover || remover.status !== 'active' || remover.role !== 'admin') {
    throw new Error('Not authorized to remove members.');
  }
  if (input.userId === input.removerId) {
    throw new Error('You cannot remove yourself.');
  }

  const membership = await getWorkspaceMembership(db, input.workspaceId, input.userId);
  if (!membership) throw new Error('Member not found.');
  if (membership.status !== 'active') throw new Error('Only active members can be removed.');
  if (membership.role === 'admin') throw new Error('Cannot remove an admin member.');

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId)));

  return { workspaceId: input.workspaceId, userId: input.userId };
};
