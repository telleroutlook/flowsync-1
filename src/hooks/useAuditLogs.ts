import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../../services/apiService';
import type { AuditLog } from '../../types';
import { useI18n } from '../i18n';

interface UseAuditLogsProps {
  activeProjectId: string;
  refreshData: () => Promise<void>;
  appendSystemMessage: (text: string) => void;
}

type AuditFilters = {
  actor: string;
  action: string;
  entityType: string;
  q: string;
  from: string;
  to: string;
};

const INITIAL_FILTERS: AuditFilters = {
  actor: 'all',
  action: 'all',
  entityType: 'all',
  q: '',
  from: '',
  to: '',
};

const parseDateFilter = (dateStr: string, isEndOfDay: boolean): number | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(`${dateStr}T${isEndOfDay ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

export const useAuditLogs = ({ activeProjectId, refreshData, appendSystemMessage }: UseAuditLogsProps) => {
  const { t } = useI18n();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Pagination & Filtering
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(INITIAL_FILTERS);

  const refreshAuditLogs = useCallback(async (projectId?: string, pageOverride?: number, pageSizeOverride?: number) => {
    const targetProjectId = projectId || activeProjectId;
    if (!targetProjectId) {
      setAuditLogs([]);
      setAuditTotal(0);
      return;
    }
    try {
      setIsAuditLoading(true);
      setAuditError(null);

      const result = await apiService.listAuditLogs({
        projectId: targetProjectId,
        page: pageOverride ?? auditPage,
        pageSize: pageSizeOverride ?? auditPageSize,
        actor: auditFilters.actor === 'all' ? undefined : auditFilters.actor,
        action: auditFilters.action === 'all' ? undefined : auditFilters.action,
        entityType: auditFilters.entityType === 'all' ? undefined : auditFilters.entityType,
        q: auditFilters.q.trim() || undefined,
        from: parseDateFilter(auditFilters.from, false),
        to: parseDateFilter(auditFilters.to, true),
      });

      setAuditLogs(result.data);
      setAuditTotal(result.total);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : t('error.load_audit'));
    } finally {
      setIsAuditLoading(false);
    }
  }, [activeProjectId, auditPage, auditPageSize, auditFilters, t]);

  // Reset to page 1 when filters or page size changes
  useEffect(() => {
    setAuditPage(1);
  }, [auditFilters, auditPageSize]);

  // Debounced refresh for search input to reduce API calls
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void refreshAuditLogs(activeProjectId);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [refreshAuditLogs, activeProjectId]);

  return {
    auditLogs,
    auditTotal,
    isAuditLoading,
    auditError,
    auditPage,
    setAuditPage,
    auditPageSize,
    setAuditPageSize,
    auditFilters,
    setAuditFilters,
    refreshAuditLogs
  };
};
