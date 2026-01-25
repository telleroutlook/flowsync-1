import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuditLogs } from './useAuditLogs';
import { apiService } from '../../services/apiService';
import { AuditLog } from '../../types';
import { I18nProvider } from '../i18n';

vi.mock('../../services/apiService', () => ({
  apiService: {
    listAuditLogs: vi.fn(),
    rollbackAuditLog: vi.fn(),
  },
}));

const api = apiService as unknown as {
  listAuditLogs: ReturnType<typeof vi.fn>;
  rollbackAuditLog: ReturnType<typeof vi.fn>;
};

const logs: AuditLog[] = [
  {
    id: 'a1',
    entityType: 'task',
    entityId: 't1',
    action: 'update',
    actor: 'user',
    timestamp: 1,
  },
];

describe('useAuditLogs', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );

  beforeEach(() => {
    api.listAuditLogs.mockResolvedValue({ data: logs, total: 1, page: 1, pageSize: 8 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads audit logs and supports filter updates', async () => {
    const refreshData = vi.fn(async () => {});
    const appendSystemMessage = vi.fn();

    const { result } = renderHook(() =>
      useAuditLogs({
        activeProjectId: 'p1',
        refreshData,
        appendSystemMessage,
      }), { wrapper }
    );

    await waitFor(() => expect(result.current.isAuditLoading).toBe(false));

    expect(result.current.auditLogs).toHaveLength(1);

    act(() => {
      result.current.setAuditFilters({
        actor: 'user',
        action: 'all',
        entityType: 'all',
        q: '',
        from: '',
        to: '',
      });
    });

    await waitFor(() => expect(api.listAuditLogs).toHaveBeenCalled());

    const lastCall = api.listAuditLogs.mock.calls.at(-1)?.[0];
    expect(lastCall?.actor).toBe('user');
  });

  it('rolls back audit entries and refreshes data', async () => {
    const refreshData = vi.fn(async () => {});
    const appendSystemMessage = vi.fn();

    api.rollbackAuditLog.mockResolvedValue({ audit: logs[0], entity: null });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() =>
      useAuditLogs({
        activeProjectId: 'p1',
        refreshData,
        appendSystemMessage,
      }), { wrapper }
    );

    await waitFor(() => expect(result.current.isAuditLoading).toBe(false));

    await act(async () => {
      await result.current.handleRollbackAudit('a1');
    });

    expect(api.rollbackAuditLog).toHaveBeenCalledWith('a1', 'user');
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(api.listAuditLogs).toHaveBeenCalled();
    expect(appendSystemMessage).toHaveBeenCalledWith('Rollback applied: a1');

    confirmSpy.mockRestore();
  });
});
