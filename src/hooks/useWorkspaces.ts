import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/apiService';
import type { User, WorkspaceJoinRequest, WorkspaceMember, WorkspaceWithMembership } from '../../types';
import { PUBLIC_WORKSPACE_ID } from '../../types';

const STORAGE_KEY = 'flowsync:activeWorkspaceId';

const readStoredWorkspace = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeWorkspace = (id: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
};

export const useWorkspaces = (user: User | null) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(PUBLIC_WORKSPACE_ID);
  const [pendingRequests, setPendingRequests] = useState<WorkspaceJoinRequest[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessibleWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.isPublic || workspace.membership?.status === 'active'),
    [workspaces]
  );

  const refreshWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await apiService.listWorkspaces();
      setWorkspaces(list);

      const stored = readStoredWorkspace();
      const accessible = list.filter((workspace) => workspace.isPublic || workspace.membership?.status === 'active');
      const fallback = accessible[0]?.id || PUBLIC_WORKSPACE_ID;
      const next = stored && accessible.some((workspace) => workspace.id === stored) ? stored : fallback;
      setActiveWorkspaceId(next);
      storeWorkspace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
  }, [user?.id]); // refreshWorkspaces is stable, user?.id changes when user logs in/out

  useEffect(() => {
    const current = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
    const userId = user?.id;
    const membership = current?.membership;
    if (!userId || !current || membership?.role !== 'admin' || membership?.status !== 'active') {
      setPendingRequests([]);
      setMembers([]);
      return;
    }
    Promise.all([
      apiService.listWorkspaceRequests(activeWorkspaceId).catch(() => [] as WorkspaceJoinRequest[]),
      apiService.listWorkspaceMembers(activeWorkspaceId).catch(() => [] as WorkspaceMember[]),
    ]).then(([requests, memberList]) => {
      setPendingRequests(requests);
      setMembers(memberList);
    });
  }, [activeWorkspaceId, user?.id, workspaces]);

  const selectWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    storeWorkspace(id);
  }, []);

  const createWorkspace = useCallback(async (name: string, description?: string) => {
    const workspace = await apiService.createWorkspace({ name, description });
    await refreshWorkspaces();
    if (workspace?.id) {
      selectWorkspace(workspace.id);
    }
    return workspace;
  }, [refreshWorkspaces, selectWorkspace]);

  const requestJoin = useCallback(async (workspaceId: string) => {
    const membership = await apiService.requestJoinWorkspace(workspaceId);
    await refreshWorkspaces();
    return membership;
  }, [refreshWorkspaces]);

  const approveRequest = useCallback(async (workspaceId: string, userId: string) => {
    const membership = await apiService.approveWorkspaceRequest(workspaceId, userId);
    const [requests, memberList] = await Promise.all([
      apiService.listWorkspaceRequests(workspaceId).catch(() => [] as WorkspaceJoinRequest[]),
      apiService.listWorkspaceMembers(workspaceId).catch(() => [] as WorkspaceMember[]),
    ]);
    setPendingRequests(requests);
    setMembers(memberList);
    await refreshWorkspaces();
    return membership;
  }, [refreshWorkspaces]);

  const rejectRequest = useCallback(async (workspaceId: string, userId: string) => {
    await apiService.rejectWorkspaceRequest(workspaceId, userId);
    const [requests, memberList] = await Promise.all([
      apiService.listWorkspaceRequests(workspaceId).catch(() => [] as WorkspaceJoinRequest[]),
      apiService.listWorkspaceMembers(workspaceId).catch(() => [] as WorkspaceMember[]),
    ]);
    setPendingRequests(requests);
    setMembers(memberList);
    await refreshWorkspaces();
  }, [refreshWorkspaces]);

  const removeMember = useCallback(async (workspaceId: string, userId: string) => {
    await apiService.removeWorkspaceMember(workspaceId, userId);
    const memberList = await apiService.listWorkspaceMembers(workspaceId).catch(() => [] as WorkspaceMember[]);
    setMembers(memberList);
    await refreshWorkspaces();
  }, [refreshWorkspaces]);

  return {
    workspaces,
    accessibleWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId: selectWorkspace,
    pendingRequests,
    members,
    isLoading,
    error,
    refreshWorkspaces,
    createWorkspace,
    requestJoin,
    approveRequest,
    rejectRequest,
    removeMember,
  };
};
