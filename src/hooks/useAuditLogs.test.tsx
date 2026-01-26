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
  },
}));

const api = apiService as unknown as {
  listAuditLogs: ReturnType<typeof vi.fn>;
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

    await waitFor(() => expect(result.current.auditLogs).toHaveLength(1));

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

    await waitFor(() => expect(api.listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ actor: 'user' })));
  });
});
