import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiService } from '../../services/apiService';
import { Project, Task } from '../../types';
import { useI18n } from '../i18n';

const PAGE_SIZE = 100;

export const useProjectData = (workspaceId: string) => {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);
  const activeProjectIdRef = useRef<string>('');

  const fallbackProject = useMemo(() => ({ id: '', name: t('project.none'), description: '' }), [t]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || projects[0] || fallbackProject;
  }, [projects, activeProjectId, fallbackProject]);

  const activeTasks = useMemo(() => {
    if (!activeProjectId) return [];
    return tasks.filter(task => task.projectId === activeProjectId);
  }, [tasks, activeProjectId]);

  const fetchAllTasks = useCallback(async (projectId?: string) => {
    const collected: Task[] = [];
    let page = 1;
    let total = 0;
    try {
      do {
        const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
        if (projectId) params.projectId = projectId;
        const result = await apiService.listTasks(params);
        collected.push(...result.data);
        total = result.total;
        page += 1;
      } while (collected.length < total);
      return collected;
    } catch (err) {
      throw err;
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const projectList = await apiService.listProjects();
      if (!isMountedRef.current) return;

      setProjects(projectList);

      const storageKey = workspaceId ? `flowsync:activeProjectId:${workspaceId}` : 'flowsync:activeProjectId';
      const stored = window.localStorage.getItem(storageKey);
      const candidate = stored && projectList.find(project => project.id === stored) ? stored : activeProjectIdRef.current;
      const finalId = candidate && projectList.find(project => project.id === candidate)
          ? candidate
          : projectList[0]?.id || '';

      setActiveProjectId(finalId);
      activeProjectIdRef.current = finalId;

      // Only fetch tasks for the active project
      const taskList = await fetchAllTasks(finalId);
      if (!isMountedRef.current) return;
      setTasks(taskList);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : t('error.load_data'));
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchAllTasks, t, workspaceId]);

  const handleSelectProject = useCallback(async (id: string) => {
    setActiveProjectId(id);
    activeProjectIdRef.current = id;
    const storageKey = workspaceId ? `flowsync:activeProjectId:${workspaceId}` : 'flowsync:activeProjectId';
    window.localStorage.setItem(storageKey, id);
    try {
      setIsLoading(true);
      const newTasks = await fetchAllTasks(id);
      if (!isMountedRef.current) return;
      setTasks(newTasks);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(t('error.load_project_tasks'));
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchAllTasks, t, workspaceId]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    refreshData();

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshData, workspaceId]); // re-run when workspace changes

  // Persist active project selection
  useEffect(() => {
    if (activeProjectId) {
      const storageKey = workspaceId ? `flowsync:activeProjectId:${workspaceId}` : 'flowsync:activeProjectId';
      window.localStorage.setItem(storageKey, activeProjectId);
    }
  }, [activeProjectId, workspaceId]);

  return {
    projects,
    tasks,
    setTasks,
    activeProjectId,
    activeProject,
    activeTasks,
    isLoading,
    error,
    refreshData,
    handleSelectProject,
    fetchAllTasks
  };
};
