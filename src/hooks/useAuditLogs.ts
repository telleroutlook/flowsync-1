import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../services/apiService';
import { AuditLog } from '../../types';

interface UseAuditLogsProps {
  activeProjectId: string;
  refreshData: () => Promise<void>;
  appendSystemMessage: (text: string) => void;
}

export const useAuditLogs = ({ activeProjectId, refreshData, appendSystemMessage }: UseAuditLogsProps) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [rollbackingAuditId, setRollbackingAuditId] = useState<string | null>(null);
  
  // Pagination & Filtering
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);
  const [auditFilters, setAuditFilters] = useState({
    actor: 'all',
    action: 'all',
    entityType: 'all',
    q: '',
    from: '',
    to: '',
  });

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
      const from = auditFilters.from ? new Date(`${auditFilters.from}T00:00:00`).getTime() : undefined;
      const to = auditFilters.to ? new Date(`${auditFilters.to}T23:59:59`).getTime() : undefined;
      
      const result = await apiService.listAuditLogs({
        projectId: targetProjectId,
        page: pageOverride ?? auditPage,
        pageSize: pageSizeOverride ?? auditPageSize,
        actor: auditFilters.actor === 'all' ? undefined : auditFilters.actor,
        action: auditFilters.action === 'all' ? undefined : auditFilters.action,
        entityType: auditFilters.entityType === 'all' ? undefined : auditFilters.entityType,
        q: auditFilters.q.trim() ? auditFilters.q.trim() : undefined,
        from,
        to,
      });
      
      setAuditLogs(result.data);
      setAuditTotal(result.total);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Failed to load audit logs.');
    } finally {
      setIsAuditLoading(false);
    }
  }, [activeProjectId, auditPage, auditPageSize, auditFilters]);

  const handleRollbackAudit = useCallback(async (auditId: string) => {
    if (rollbackingAuditId) return;
    const confirmed = window.confirm('Rollback this audit entry? This will reverse the recorded change.');
    if (!confirmed) return;
    try {
      setRollbackingAuditId(auditId);
      await apiService.rollbackAuditLog(auditId, 'user');
      appendSystemMessage(`Rollback applied: ${auditId}`);
      await refreshData();
      await refreshAuditLogs(activeProjectId);
    } catch (error) {
      appendSystemMessage(error instanceof Error ? `Rollback failed: ${error.message}` : 'Rollback failed.');
    } finally {
      setRollbackingAuditId(null);
    }
  }, [rollbackingAuditId, activeProjectId, refreshData, refreshAuditLogs, appendSystemMessage]);

  // Effects
  useEffect(() => {
    setAuditPage(1);
  }, [auditFilters, auditPageSize]);

  useEffect(() => {
    // Debounce or just rely on dependencies. 
    // Since refreshAuditLogs is memoized with deps, calling it here is safe.
    void refreshAuditLogs(activeProjectId);
  }, [refreshAuditLogs, activeProjectId]);

  return {
    auditLogs,
    auditTotal,
    isAuditLoading,
    auditError,
    rollbackingAuditId,
    auditPage,
    setAuditPage,
    auditPageSize,
    setAuditPageSize,
    auditFilters,
    setAuditFilters,
    refreshAuditLogs,
    handleRollbackAudit
  };
};
