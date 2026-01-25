import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectData } from './useProjectData';
import { apiService } from '../../services/apiService';
import { Priority, TaskStatus, Project, Task } from '../../types';
import { I18nProvider } from '../i18n';

vi.mock('../../services/apiService', () => ({
  apiService: {
    listProjects: vi.fn(),
    listTasks: vi.fn(),
  },
}));

const mockProjects: Project[] = [
  { id: 'p1', name: 'Alpha' },
  { id: 'p2', name: 'Beta' },
];

const task = (overrides: Partial<Task>): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'Task',
  status: TaskStatus.TODO,
  priority: Priority.MEDIUM,
  createdAt: 1,
  ...overrides,
});

const mockTasksPage1 = [task({ id: 't1', projectId: 'p1' }), task({ id: 't2', projectId: 'p2' })];
const mockTasksPage2 = [task({ id: 't3', projectId: 'p1' })];

const api = apiService as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  listTasks: ReturnType<typeof vi.fn>;
};

describe('useProjectData', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    api.listProjects.mockResolvedValue(mockProjects);
    api.listTasks.mockImplementation(async ({ page }: { page?: number }) => {
      if (page === 1) {
        return { data: mockTasksPage1, total: 3, page: 1, pageSize: 100 };
      }
      return { data: mockTasksPage2, total: 3, page: 2, pageSize: 100 };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads projects and tasks, honoring stored active project', async () => {
    localStorage.setItem('flowsync:activeProjectId:public', 'p2');

    const { result } = renderHook(() => useProjectData('public'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.listProjects).toHaveBeenCalledTimes(1);
    expect(api.listTasks).toHaveBeenCalledTimes(2);
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.tasks).toHaveLength(3);
    expect(result.current.activeProjectId).toBe('p2');
    expect(result.current.activeTasks).toHaveLength(1);
  });

  it('updates active project and persists to localStorage', async () => {
    const { result } = renderHook(() => useProjectData('public'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleSelectProject('p1');
    });

    expect(result.current.activeProjectId).toBe('p1');
    expect(localStorage.getItem('flowsync:activeProjectId:public')).toBe('p1');
  });
});
