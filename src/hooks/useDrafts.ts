import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../services/apiService';
import { Draft, DraftAction, ChatMessage } from '../../types';

interface UseDraftsProps {
  activeProjectId: string;
  refreshData: () => Promise<void>;
  refreshAuditLogs: (projectId?: string) => Promise<void>;
  appendSystemMessage: (text: string) => void;
}

export const useDrafts = ({ activeProjectId, refreshData, refreshAuditLogs, appendSystemMessage }: UseDraftsProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);

  const pendingDraft = useMemo(
    () => drafts.find(draft => draft.id === pendingDraftId) || null,
    [drafts, pendingDraftId]
  );

  const refreshDrafts = useCallback(async () => {
    try {
      const items = await apiService.listDrafts();
      setDrafts(items);
      // If the pending draft is no longer pending (e.g. applied elsewhere), clear it
      setPendingDraftId(prevId => {
         if (prevId && !items.find(item => item.id === prevId && item.status === 'pending')) {
             return null;
         }
         return prevId;
      });
    } catch (err) {
      // Silently fail on draft refresh
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  const submitDraft = useCallback(async (
    actions: DraftAction[],
    options: { reason?: string; createdBy: Draft['createdBy']; autoApply?: boolean; silent?: boolean }
  ) => {
    try {
      const result = await apiService.createDraft({
        projectId: activeProjectId || undefined,
        createdBy: options.createdBy,
        reason: options.reason,
        actions,
      });
      
      setDraftWarnings(result.warnings);
      
      if (result.warnings.length > 0 && !options.silent) {
        appendSystemMessage(`Draft warnings: ${result.warnings.join(' | ')}`);
      }
      
      setDrafts(prev => [...prev, result.draft]);
      
      if (options.autoApply) {
        const applied = await apiService.applyDraft(result.draft.id, options.createdBy);
        setDrafts(prev => prev.map(draft => (draft.id === applied.draft.id ? applied.draft : draft)));
        await refreshData();
        await refreshAuditLogs(activeProjectId);
        if (!options.silent) {
          appendSystemMessage(`Draft applied: ${applied.draft.id}`);
        }
        return applied.draft;
      }
      
      setPendingDraftId(result.draft.id);
      if (!options.silent) {
        appendSystemMessage(`Draft created: ${result.draft.id}. Awaiting approval.`);
      }
      return result.draft;
    } catch (error) {
       const msg = error instanceof Error ? error.message : 'Failed to submit draft';
       if (!options.silent) appendSystemMessage(`Error: ${msg}`);
       throw error;
    }
  }, [activeProjectId, refreshData, refreshAuditLogs, appendSystemMessage]);

  const handleApplyDraft = useCallback(async (draftId: string) => {
    try {
      const result = await apiService.applyDraft(draftId, 'user');
      setDrafts(prev => prev.map(draft => (draft.id === result.draft.id ? result.draft : draft)));
      setPendingDraftId(null);
      await refreshData();
      await refreshDrafts();
      await refreshAuditLogs(activeProjectId);
      appendSystemMessage(`Draft applied: ${draftId}`);
    } catch (error) {
       appendSystemMessage(error instanceof Error ? `Failed to apply draft: ${error.message}` : 'Failed to apply draft');
    }
  }, [refreshData, refreshDrafts, refreshAuditLogs, activeProjectId, appendSystemMessage]);

  const handleDiscardDraft = useCallback(async (draftId: string) => {
    try {
      const result = await apiService.discardDraft(draftId);
      setDrafts(prev => prev.map(draft => (draft.id === result.id ? result : draft)));
      if (pendingDraftId === draftId) setPendingDraftId(null);
      await refreshDrafts();
      appendSystemMessage(`Draft discarded: ${draftId}`);
    } catch (error) {
       appendSystemMessage(error instanceof Error ? `Failed to discard draft: ${error.message}` : 'Failed to discard draft');
    }
  }, [pendingDraftId, refreshDrafts, appendSystemMessage]);

  return {
    drafts,
    pendingDraft,
    pendingDraftId,
    setPendingDraftId,
    draftWarnings,
    refreshDrafts,
    submitDraft,
    handleApplyDraft,
    handleDiscardDraft
  };
};
