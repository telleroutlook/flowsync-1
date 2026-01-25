import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDrafts } from './useDrafts';
import { apiService } from '../../services/apiService';
import { Draft, DraftAction } from '../../types';
import { I18nProvider } from '../i18n';

vi.mock('../../services/apiService', () => ({
  apiService: {
    listDrafts: vi.fn(),
    createDraft: vi.fn(),
    applyDraft: vi.fn(),
    discardDraft: vi.fn(),
  },
}));

const api = apiService as unknown as {
  listDrafts: ReturnType<typeof vi.fn>;
  createDraft: ReturnType<typeof vi.fn>;
  applyDraft: ReturnType<typeof vi.fn>;
  discardDraft: ReturnType<typeof vi.fn>;
};

const draftBase: Draft = {
  id: 'd1',
  projectId: 'p1',
  status: 'pending',
  actions: [],
  createdAt: 1,
  createdBy: 'user',
};

const action: DraftAction = {
  id: 'a1',
  entityType: 'task',
  action: 'create',
  after: { title: 'New task' },
};

describe('useDrafts', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );

  beforeEach(() => {
    api.listDrafts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates draft, tracks warnings, and sets pending draft', async () => {
    const appendSystemMessage = vi.fn();
    const refreshData = vi.fn(async () => {});
    const refreshAuditLogs = vi.fn(async () => {});

    api.createDraft.mockResolvedValue({
      draft: draftBase,
      warnings: ['Missing assignee'],
    });

    const { result } = renderHook(() =>
      useDrafts({
        activeProjectId: 'p1',
        refreshData,
        refreshAuditLogs,
        appendSystemMessage,
      }), { wrapper }
    );

    await waitFor(() => expect(api.listDrafts).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.submitDraft([action], {
        createdBy: 'user',
        reason: 'test',
      });
    });

    expect(result.current.pendingDraftId).toBe('d1');
    expect(result.current.draftWarnings).toEqual(['Missing assignee']);
    expect(appendSystemMessage).toHaveBeenCalledWith('Draft warnings: Missing assignee');
    expect(appendSystemMessage).toHaveBeenCalledWith('Draft created: d1. Awaiting approval.');
  });

  it('applies a draft and refreshes data', async () => {
    const appendSystemMessage = vi.fn();
    const refreshData = vi.fn(async () => {});
    const refreshAuditLogs = vi.fn(async () => {});

    api.applyDraft.mockResolvedValue({
      draft: { ...draftBase, status: 'applied' },
      results: [],
    });

    const { result } = renderHook(() =>
      useDrafts({
        activeProjectId: 'p1',
        refreshData,
        refreshAuditLogs,
        appendSystemMessage,
      }), { wrapper }
    );

    await waitFor(() => expect(api.listDrafts).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setPendingDraftId('d1');
    });

    await act(async () => {
      await result.current.handleApplyDraft('d1');
    });

    expect(api.applyDraft).toHaveBeenCalledWith('d1', 'user');
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(refreshAuditLogs).toHaveBeenCalledWith('p1');
    expect(result.current.pendingDraftId).toBe(null);
    expect(appendSystemMessage).toHaveBeenCalledWith('Draft applied: d1');
  });

  it('discards a draft and refreshes list', async () => {
    const appendSystemMessage = vi.fn();
    const refreshData = vi.fn(async () => {});
    const refreshAuditLogs = vi.fn(async () => {});

    api.discardDraft.mockResolvedValue({ ...draftBase, status: 'discarded' });

    const { result } = renderHook(() =>
      useDrafts({
        activeProjectId: 'p1',
        refreshData,
        refreshAuditLogs,
        appendSystemMessage,
      }), { wrapper }
    );

    await waitFor(() => expect(api.listDrafts).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.handleDiscardDraft('d1');
    });

    expect(api.discardDraft).toHaveBeenCalledWith('d1');
    expect(api.listDrafts).toHaveBeenCalledTimes(2);
    expect(appendSystemMessage).toHaveBeenCalledWith('Draft discarded: d1');
  });
});
