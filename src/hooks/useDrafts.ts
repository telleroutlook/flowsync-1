import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../services/apiService';
import { Draft, DraftAction } from '../../types';
import { useI18n } from '../i18n';

interface UseDraftsProps {
  activeProjectId: string;
  refreshData: () => Promise<void>;
  refreshAuditLogs: (projectId?: string) => Promise<void>;
  appendSystemMessage: (text: string) => void;
}

export const useDrafts = ({ activeProjectId, refreshData, refreshAuditLogs, appendSystemMessage }: UseDraftsProps) => {
  const { t } = useI18n();
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
        appendSystemMessage(t('draft.warnings', { warnings: result.warnings.join(' | ') }));
      }
      
      setDrafts(prev => [...prev, result.draft]);
      
      if (options.autoApply) {
        const applied = await apiService.applyDraft(result.draft.id, options.createdBy);
        setDrafts(prev => prev.map(draft => (draft.id === applied.draft.id ? applied.draft : draft)));
        await refreshData();
        await refreshAuditLogs(activeProjectId);
        if (!options.silent) {
          appendSystemMessage(t('draft.applied', { id: applied.draft.id }));
        }
        return applied.draft;
      }
      
      setPendingDraftId(result.draft.id);
      if (!options.silent) {
        appendSystemMessage(t('draft.created', { id: result.draft.id }));
      }
      return result.draft;
    } catch (error) {
       const msg = error instanceof Error ? error.message : t('draft.submit_failed');
       if (!options.silent) appendSystemMessage(t('chat.error_prefix', { error: msg }));
       throw error;
    }
  }, [activeProjectId, refreshData, refreshAuditLogs, appendSystemMessage, t]);

  const handleApplyDraft = useCallback(async (draftId: string) => {
    try {
      const result = await apiService.applyDraft(draftId, 'user');
      setDrafts(prev => prev.map(draft => (draft.id === result.draft.id ? result.draft : draft)));
      setPendingDraftId(null);
      await refreshData();
      await refreshDrafts();
      await refreshAuditLogs(activeProjectId);
      appendSystemMessage(t('draft.applied', { id: draftId }));
    } catch (error) {
       appendSystemMessage(error instanceof Error ? t('draft.apply_failed', { error: error.message }) : t('draft.apply_failed', { error: t('common.na') }));
    }
  }, [refreshData, refreshDrafts, refreshAuditLogs, activeProjectId, appendSystemMessage, t]);

  const handleDiscardDraft = useCallback(async (draftId: string) => {
    try {
      const result = await apiService.discardDraft(draftId);
      setDrafts(prev => prev.map(draft => (draft.id === result.id ? result : draft)));
      if (pendingDraftId === draftId) setPendingDraftId(null);
      await refreshDrafts();
      appendSystemMessage(t('draft.discarded', { id: draftId }));
    } catch (error) {
       appendSystemMessage(error instanceof Error ? t('draft.discard_failed', { error: error.message }) : t('draft.discard_failed', { error: t('common.na') }));
    }
  }, [pendingDraftId, refreshDrafts, appendSystemMessage, t]);

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
