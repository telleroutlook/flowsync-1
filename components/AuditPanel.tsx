import React, { useState, memo, useMemo, useCallback } from 'react';
import { AuditLog } from '../types';
import { useI18n } from '../src/i18n';
import { getActionLabel, getEntityLabel, getActorLabel } from '../src/i18n/labels';
import { cn } from '../src/utils/cn';

interface AuditPanelProps {
  isOpen: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  filters: {
    actor: string;
    action: string;
    entityType: string;
    q: string;
    from: string;
    to: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    actor: string;
    action: string;
    entityType: string;
    q: string;
    from: string;
    to: string;
  }>>;
  logs: AuditLog[];
  total: number;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  error: string | null;
}

const MIN_TIMESTAMP_MS = Date.parse('2000-01-01T00:00:00.000Z');
const MAX_TIMESTAMP_MS = Date.parse('2100-01-01T00:00:00.000Z');

const isLikelyTimestamp = (value: number): boolean =>
  Number.isFinite(value) && value >= MIN_TIMESTAMP_MS && value <= MAX_TIMESTAMP_MS;

const formatDateOnly = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatAuditTimestamp = (timestamp: number) => formatDateOnly(timestamp);

const normalizeAuditValue = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const formatAuditDisplayValue = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return isLikelyTimestamp(value) ? formatDateOnly(value) : String(value);
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const diffAuditRecords = (before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) => {
  const entries: { path: string; before: string; after: string }[] = [];
  const visited = new Set<string>();

  const walk = (path: string, a: unknown, b: unknown): void => {
    const key = `${path}:${typeof a}:${typeof b}`;
    if (visited.has(key)) return;
    visited.add(key);

    const aIsObject = a && typeof a === 'object' && !Array.isArray(a);
    const bIsObject = b && typeof b === 'object' && !Array.isArray(b);

    if (aIsObject || bIsObject) {
      const aObj = (aIsObject ? (a as Record<string, unknown>) : {}) as Record<string, unknown>;
      const bObj = (bIsObject ? (b as Record<string, unknown>) : {}) as Record<string, unknown>;
      const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
      for (const k of keys) {
        walk(path ? `${path}.${k}` : k, aObj[k], bObj[k]);
      }
      return;
    }

    const aCompare = normalizeAuditValue(a);
    const bCompare = normalizeAuditValue(b);
    if (aCompare !== bCompare) {
      entries.push({
        path: path || 'root',
        before: formatAuditDisplayValue(a),
        after: formatAuditDisplayValue(b),
      });
    }
  };

  walk('', before ?? null, after ?? null);
  return entries;
};

// Use record lookup instead of switch for better performance
const AUDIT_BADGE_CLASSES: Record<string, string> = {
  create: 'bg-success/10 text-success border-success/20',
  update: 'bg-primary/10 text-primary border-primary/20',
  delete: 'bg-negative/10 text-negative border-negative/20',
  rollback: 'bg-secondary/10 text-text-secondary border-border-subtle',
};

const auditBadgeClass = (action: string): string => {
  return AUDIT_BADGE_CLASSES[action] || 'bg-secondary/10 text-text-secondary border-border-subtle';
};

const updateFilter = (
  setFilters: AuditPanelProps['setFilters'],
  key: keyof AuditPanelProps['filters']
) => (event: React.ChangeEvent<HTMLSelectElement>) => setFilters(prev => ({ ...prev, [key]: event.target.value }));

export const AuditPanel = memo<AuditPanelProps>(({
  isOpen,
  isLoading,
  onRefresh,
  filters,
  setFilters,
  logs,
  total,
  page,
  setPage,
  pageSize,
  setPageSize,
  error,
}) => {
  const { t } = useI18n();
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [isAuditDetailOpen, setIsAuditDetailOpen] = useState(false);
  const [showAuditRaw, setShowAuditRaw] = useState(false);

  const auditTotalPages = Math.max(1, Math.ceil(total / pageSize));

  const openAuditDetail = useCallback((log: AuditLog) => {
    setSelectedAudit(log);
    setIsAuditDetailOpen(true);
    setShowAuditRaw(false);
  }, []);

  const closeAuditDetail = useCallback(() => {
    setIsAuditDetailOpen(false);
    setSelectedAudit(null);
  }, []);

  const selectedAuditDiff = useMemo(() => {
    if (!selectedAudit) return [];
    return diffAuditRecords(selectedAudit.before ?? null, selectedAudit.after ?? null);
  }, [selectedAudit]);

  // Memoize filter updaters to avoid recreating on every render
  const updateActorFilter = useCallback(updateFilter(setFilters, 'actor'), [setFilters]);
  const updateActionFilter = useCallback(updateFilter(setFilters, 'action'), [setFilters]);
  const updateEntityFilter = useCallback(updateFilter(setFilters, 'entityType'), [setFilters]);

  if (!isOpen) return null;

  return (
    <>
      <div className="px-6 py-4 border-b border-border-subtle bg-surface/95 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-text-primary uppercase tracking-widest">{t('audit.title')}</p>
            <p className="text-xs text-text-secondary">{t('audit.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary transition-colors"
            disabled={isLoading}
          >
            {isLoading ? t('audit.refreshing') : t('audit.refresh')}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={filters.q}
            onChange={(event) => setFilters(prev => ({ ...prev, q: event.target.value }))}
            placeholder={t('audit.search_placeholder')}
            className="w-44 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary outline-none"
          />
          <select
            value={filters.actor}
            onChange={updateActorFilter}
            className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm text-text-secondary focus:border-primary outline-none"
          >
            <option value="all">{t('audit.actors.all')}</option>
            <option value="user">{t('audit.actors.user')}</option>
            <option value="agent">{t('audit.actors.agent')}</option>
            <option value="system">{t('audit.actors.system')}</option>
          </select>
          <select
            value={filters.action}
            onChange={updateActionFilter}
            className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm text-text-secondary focus:border-primary outline-none"
          >
            <option value="all">{t('audit.actions.all')}</option>
            <option value="create">{t('audit.actions.create')}</option>
            <option value="update">{t('audit.actions.update')}</option>
            <option value="delete">{t('audit.actions.delete')}</option>
          </select>
          <select
            value={filters.entityType}
            onChange={updateEntityFilter}
            className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm text-text-secondary focus:border-primary outline-none"
          >
            <option value="all">{t('audit.entities.all')}</option>
            <option value="project">{t('audit.entities.project')}</option>
            <option value="task">{t('audit.entities.task')}</option>
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters(prev => ({ ...prev, from: event.target.value }))}
            className="w-[130px] rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm text-text-secondary focus:border-primary outline-none"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters(prev => ({ ...prev, to: event.target.value }))}
            className="w-[130px] rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm text-text-secondary focus:border-primary outline-none"
          />
          <button
            type="button"
            onClick={() => setFilters({ actor: 'all', action: 'all', entityType: 'all', q: '', from: '', to: '' })}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-primary hover:border-primary transition-colors"
          >
            {t('audit.clear')}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-negative/20 bg-negative/10 px-3 py-2 text-sm text-negative" role="alert">
            {error}
          </div>
        )}

        {!error && logs.length === 0 && !isLoading && (
          <div className="mt-3 rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-secondary">
            {t('audit.no_entries')}
          </div>
        )}

        <div className="mt-3 grid gap-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-4 py-2 shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className={cn("shrink-0 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider", auditBadgeClass(log.action))}>
                  {getActionLabel(log.action, t)}
                </span>
                <div className="flex items-center gap-2 text-sm text-text-primary truncate">
                  <span className="font-semibold">{getEntityLabel(log.entityType, t)}</span>
                  <span className="text-text-secondary">·</span>
                  <span className="font-mono text-xs text-text-secondary">{log.entityId}</span>
                  <span className="text-text-secondary">·</span>
                  <span className="text-text-secondary">{getActorLabel(log.actor, t)}</span>
                  <span className="text-text-secondary">·</span>
                  <span className="text-xs text-text-secondary">{formatAuditTimestamp(log.timestamp)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openAuditDetail(log)}
                className="shrink-0 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                {t('audit.details')}
              </button>
            </div>
          ))}
        </div>

        {total > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
            <div>
              {t('audit.page_info', { page: Math.min(page, auditTotalPages), totalPages: auditTotalPages, total })}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-border-subtle bg-background px-2 py-1 text-xs text-text-secondary focus:border-primary outline-none"
              >
                {[6, 8, 12, 20].map((size) => (
                  <option key={size} value={size}>{t('audit.page_size', { size })}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-semibold text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-colors"
              >
                {t('audit.prev')}
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(auditTotalPages, prev + 1))}
                disabled={page >= auditTotalPages}
                className="rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-semibold text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-colors"
              >
                {t('audit.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {isAuditDetailOpen && selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-[760px] max-w-[90vw] rounded-2xl bg-surface shadow-2xl border border-border-subtle">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div>
                <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">{t('audit.detail_title')}</p>
                <p className="text-base font-semibold text-text-primary">
                  {getEntityLabel(selectedAudit.entityType, t)} · {selectedAudit.entityId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuditRaw(prev => !prev)}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-semibold text-text-secondary hover:border-primary hover:text-primary transition-colors"
                >
                  {showAuditRaw ? t('audit.hide_json') : t('audit.show_json')}
                </button>
                <button
                  type="button"
                  onClick={closeAuditDetail}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-semibold text-text-secondary hover:border-primary hover:text-primary transition-colors"
                >
                  {t('audit.close')}
                </button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider", auditBadgeClass(selectedAudit.action))}>
                  {getActionLabel(selectedAudit.action, t)}
                </span>
                <span>{getActorLabel(selectedAudit.actor, t)}</span>
                <span>· {formatAuditTimestamp(selectedAudit.timestamp)}</span>
                {selectedAudit.reason && <span>· {selectedAudit.reason}</span>}
              </div>
              <div className="rounded-xl border border-border-subtle bg-background p-3">
                <div className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('audit.field_diff')}</div>
                {selectedAuditDiff.length === 0 ? (
                  <div className="text-sm text-text-secondary">{t('audit.no_field_changes')}</div>
                ) : (
                  <div className="max-h-[260px] overflow-auto space-y-2 text-sm text-text-primary">
                    {selectedAuditDiff.map((row) => (
                      <div key={row.path} className="rounded-lg border border-border-subtle bg-surface px-3 py-2">
                        <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">{row.path}</div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-negative/10 px-2 py-1 text-negative break-all">- {row.before}</div>
                          <div className="rounded-md bg-success/10 px-2 py-1 text-success break-all">+ {row.after}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {showAuditRaw && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border-subtle bg-background p-3">
                    <div className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('audit.before_json')}</div>
                    <pre className="max-h-[220px] overflow-auto text-sm text-text-primary whitespace-pre-wrap">
                      {JSON.stringify(selectedAudit.before ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-background p-3">
                    <div className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('audit.after_json')}</div>
                    <pre className="max-h-[220px] overflow-auto text-sm text-text-primary whitespace-pre-wrap">
                      {JSON.stringify(selectedAudit.after ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
AuditPanel.displayName = 'AuditPanel';
