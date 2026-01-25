import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExport } from './useExport';
import { Priority, TaskStatus, Project, Task } from '../../types';
import { apiService } from '../../services/apiService';
import { I18nProvider } from '../i18n';

vi.mock('../../services/apiService', () => ({
  apiService: {
    listProjects: vi.fn(),
  },
}));

const mockProjects: Project[] = [
  { id: 'p1', name: 'Alpha' },
];

const mockTasks: Task[] = [
  {
    id: 't1',
    projectId: 'p1',
    title: 'Task One',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    createdAt: 1,
  },
];

const api = apiService as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
};

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  readAsText(file: File) {
    const fileAny = file as unknown as { text?: () => Promise<string>; _text?: string };
    if (typeof fileAny.text === 'function') {
      void fileAny.text().then((text) => {
        this.result = text;
        if (this.onload) this.onload.call(this as unknown as FileReader, {} as any);
      });
      return;
    }
    this.result = fileAny._text ?? '';
    if (this.onload) this.onload.call(this as unknown as FileReader, {} as any);
  }
}

describe('useExport', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );

  const createObjectURL = vi.fn(() => 'blob:mock');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader);
    vi.stubGlobal('alert', vi.fn());
    (globalThis.URL as any).createObjectURL = createObjectURL;
    (globalThis.URL as any).revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports active tasks to CSV', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useExport({
        projects: mockProjects,
        activeProject: mockProjects[0],
        activeTasks: mockTasks,
        refreshData: vi.fn(async () => {}),
        submitDraft: vi.fn(async () => ({ id: 'd1' })),
        fetchAllTasks: vi.fn(async () => []),
      }), { wrapper }
    );

    await act(async () => {
      await result.current.handleExportTasks('csv', 'active');
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('imports tasks from CSV and submits draft actions', async () => {
    api.listProjects.mockResolvedValue(mockProjects);
    const submitDraft = vi.fn(async () => ({ id: 'd1' })) as any;
    const refreshData = vi.fn(async () => {});
    const fetchAllTasks = vi.fn(async () => mockTasks);

    const { result } = renderHook(() =>
      useExport({
        projects: mockProjects,
        activeProject: mockProjects[0],
        activeTasks: mockTasks,
        refreshData,
        submitDraft,
        fetchAllTasks,
      }), { wrapper }
    );

    const csv = [
      'rowType,projectId,project,projectDescription,projectIcon,projectCreatedAt,projectUpdatedAt,id,title,status,priority,assignee,wbs,startDate,dueDate,completion,isMilestone,predecessors,description,createdAt,updatedAt',
      'project,p1,Alpha,,A,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z,,,,,,,,,,,,,',
      'task,p1,Alpha,,,,,t2,Imported TODO,TODO,LOW,,,,,,0,false,,,"2024-01-02T00:00:00.000Z",',
    ].join('\n');

    const file = { name: 'import.csv', _text: csv } as unknown as File;

    act(() => {
      result.current.handleImportFile(file);
    });

    await waitFor(() => expect(submitDraft).toHaveBeenCalled());

    const taskCall = submitDraft.mock.calls.find((call) => call[1]?.reason === 'Import tasks');
    expect(taskCall).toBeTruthy();
    expect(refreshData).toHaveBeenCalled();
  });
});
