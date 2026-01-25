import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../services/apiService';
import { Project, Task } from '../../types';
import { useI18n } from '../i18n';

export const useProjectData = () => {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fallbackProject = useMemo(() => ({ id: '', name: t('project.none'), description: '' }), [t]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || projects[0] || fallbackProject;
  }, [projects, activeProjectId, fallbackProject]);

  const activeTasks = useMemo(() => {
    if (!activeProjectId) return [];
    return tasks.filter(t => t.projectId === activeProjectId);
  }, [tasks, activeProjectId]);

  const fetchAllTasks = useCallback(async (projectId?: string) => {
    const collected: Task[] = [];
    let page = 1;
    let total = 0;
    try {
      do {
        const params: any = { page, pageSize: 100 };
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
      setProjects(projectList);
      
      const stored = window.localStorage.getItem('flowsync:activeProjectId');
      const candidate = stored && projectList.find(project => project.id === stored) ? stored : activeProjectId;
      const finalId = candidate && projectList.find(project => project.id === candidate)
          ? candidate
          : projectList[0]?.id || '';
          
      setActiveProjectId(finalId);
      
      // Only fetch tasks for the active project
      const taskList = await fetchAllTasks(finalId);
      setTasks(taskList);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.load_data'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllTasks, t]); // Removed activeProjectId dependency to avoid stale closures

  const handleSelectProject = useCallback(async (id: string) => {
    setActiveProjectId(id);
    window.localStorage.setItem('flowsync:activeProjectId', id);
    try {
      setIsLoading(true);
      const newTasks = await fetchAllTasks(id);
      setTasks(newTasks);
    } catch (err) {
      setError(t('error.load_project_tasks'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllTasks, t]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Persist active project selection
  useEffect(() => {
    if (activeProjectId) {
      window.localStorage.setItem('flowsync:activeProjectId', activeProjectId);
    }
  }, [activeProjectId]);

  return {
    projects,
    tasks,
    setTasks, // Exposed for optimistic updates
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
