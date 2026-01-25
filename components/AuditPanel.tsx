import React, { useState } from 'react';
import { AuditLog } from '../types';
import { useI18n } from '../src/i18n';

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
  onRollback: (id: string) => void;
  rollbackingId: string | null;
  error: string | null;
}

const formatAuditTimestamp = (timestamp: number, locale: string) =>
  new Date(timestamp).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

const formatAuditValue = (value: unknown) => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const diffAuditRecords = (before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) => {
  const entries: { path: string; before: string; after: string }[] = [];
  const visited = new Set<string>();
  const walk = (path: string, a: unknown, b: unknown) => {
    const key = `${path}:${typeof a}:${typeof b}`;
    if (visited.has(key)) return;
    visited.add(key);

    const aIsObject = a && typeof a === 'object' && !Array.isArray(a);
    const bIsObject = b && typeof b === 'object' && !Array.isArray(b);
    if (aIsObject || bIsObject) {
      const aObj = (aIsObject ? (a as Record<string, unknown>) : {}) as Record<string, unknown>;
      const bObj = (bIsObject ? (b as Record<string, unknown>) : {}) as Record<string, unknown>;
      const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
      keys.forEach((k) => walk(path ? `${path}.${k}` : k, aObj[k], bObj[k]));
      return;
    }

    const aVal = formatAuditValue(a);
    const bVal = formatAuditValue(b);
    if (aVal !== bVal) {
      entries.push({ path: path || 'root', before: aVal, after: bVal });
    }
  };

  walk('', before ?? null, after ?? null);
  return entries;
};

const auditBadgeClass = (action: string) => {
  switch (action) {
    case 'create':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'update':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'delete':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'rollback':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

export const AuditPanel = React.memo<AuditPanelProps>(({
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
  onRollback,
  rollbackingId,
  error,
}) => {
  const { t, locale } = useI18n();
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [isAuditDetailOpen, setIsAuditDetailOpen] = useState(false);
  const [showAuditRaw, setShowAuditRaw] = useState(false);

  const auditTotalPages = Math.max(1, Math.ceil(total / pageSize));

  const openAuditDetail = (log: AuditLog) => {
    setSelectedAudit(log);
    setIsAuditDetailOpen(true);
    setShowAuditRaw(false);
  };

  const closeAuditDetail = () => {
    setIsAuditDetailOpen(false);
    setSelectedAudit(null);
  };

  if (!isOpen) return null;

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return t('audit.actions.create');
      case 'update':
        return t('audit.actions.update');
      case 'delete':
        return t('audit.actions.delete');
      case 'rollback':
        return t('audit.actions.rollback');
      default:
        return action;
    }
  };

  const getEntityLabel = (entityType: string) => {
    switch (entityType) {
      case 'project':
        return t('audit.entities.project');
      case 'task':
        return t('audit.entities.task');
      default:
        return entityType;
    }
  };

  const getActorLabel = (actor: string) => {
    switch (actor) {
      case 'user':
        return t('audit.actors.user');
      case 'agent':
        return t('audit.actors.agent');
      case 'system':
        return t('audit.actors.system');
      default:
        return actor;
    }
  };

  return (
    <>
      <div className="px-6 py-4 border-b border-slate-200 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">{t('audit.title')}</p>
            <p className="text-[11px] text-slate-500">{t('audit.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
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
            className="w-44 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-400 outline-none"
          />
          <select
            value={filters.actor}
            onChange={(event) => setFilters(prev => ({ ...prev, actor: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-400 outline-none"
          >
            <option value="all">{t('audit.actors.all')}</option>
            <option value="user">{t('audit.actors.user')}</option>
            <option value="agent">{t('audit.actors.agent')}</option>
            <option value="system">{t('audit.actors.system')}</option>
          </select>
          <select
            value={filters.action}
            onChange={(event) => setFilters(prev => ({ ...prev, action: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-400 outline-none"
          >
            <option value="all">{t('audit.actions.all')}</option>
            <option value="create">{t('audit.actions.create')}</option>
            <option value="update">{t('audit.actions.update')}</option>
            <option value="delete">{t('audit.actions.delete')}</option>
            <option value="rollback">{t('audit.actions.rollback')}</option>
          </select>
          <select
            value={filters.entityType}
            onChange={(event) => setFilters(prev => ({ ...prev, entityType: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-400 outline-none"
          >
            <option value="all">{t('audit.entities.all')}</option>
            <option value="project">{t('audit.entities.project')}</option>
            <option value="task">{t('audit.entities.task')}</option>
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters(prev => ({ ...prev, from: event.target.value }))}
            className="w-[130px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-400 outline-none"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters(prev => ({ ...prev, to: event.target.value }))}
            className="w-[130px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-400 outline-none"
          />
          <button
            type="button"
            onClick={() => setFilters({ actor: 'all', action: 'all', entityType: 'all', q: '', from: '', to: '' })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
          >
            {t('audit.clear')}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!error && logs.length === 0 && !isLoading && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {t('audit.no_entries')}
          </div>
        )}

        <div className="mt-3 grid gap-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${auditBadgeClass(log.action)}`}>
                  {getActionLabel(log.action)}
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-700">
                    {getEntityLabel(log.entityType)} · {log.entityId}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {getActorLabel(log.actor)} · {formatAuditTimestamp(log.timestamp, locale)}
                  </div>
                  {log.reason && (
                    <div className="text-[11px] text-slate-500">{t('audit.reason', { reason: log.reason })}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuditDetail(log)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  {t('audit.details')}
                </button>
                <button
                  type="button"
                  onClick={() => onRollback(log.id)}
                  disabled={log.action === 'rollback' || rollbackingId === log.id}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    log.action === 'rollback'
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  {rollbackingId === log.id ? t('audit.rolling_back') : t('audit.rollback')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {total > 0 && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              {t('audit.page_info', { page: Math.min(page, auditTotalPages), totalPages: auditTotalPages, total })}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 focus:border-indigo-400 outline-none"
              >
                {[6, 8, 12, 20].map((size) => (
                  <option key={size} value={size}>{t('audit.page_size', { size })}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed hover:border-indigo-200 hover:text-indigo-600 transition-colors"
              >
                {t('audit.prev')}
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(auditTotalPages, prev + 1))}
                disabled={page >= auditTotalPages}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed hover:border-indigo-200 hover:text-indigo-600 transition-colors"
              >
                {t('audit.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {isAuditDetailOpen && selectedAudit && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-[760px] max-w-[90vw] rounded-2xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('audit.detail_title')}</p>
                <p className="text-sm font-semibold text-slate-800">
                  {getEntityLabel(selectedAudit.entityType)} · {selectedAudit.entityId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuditRaw(prev => !prev)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  {showAuditRaw ? t('audit.hide_json') : t('audit.show_json')}
                </button>
                <button
                  type="button"
                  onClick={closeAuditDetail}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  {t('audit.close')}
                </button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className={`inline-flex rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider ${auditBadgeClass(selectedAudit.action)}`}>
                  {getActionLabel(selectedAudit.action)}
                </span>
                <span>{getActorLabel(selectedAudit.actor)}</span>
                <span>· {formatAuditTimestamp(selectedAudit.timestamp, locale)}</span>
                {selectedAudit.reason && <span>· {selectedAudit.reason}</span>}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('audit.field_diff')}</div>
                {diffAuditRecords(selectedAudit.before ?? null, selectedAudit.after ?? null).length === 0 ? (
                  <div className="text-[11px] text-slate-500">{t('audit.no_field_changes')}</div>
                ) : (
                  <div className="max-h-[260px] overflow-auto space-y-2 text-[11px] text-slate-700">
                    {diffAuditRecords(selectedAudit.before ?? null, selectedAudit.after ?? null).map((row) => (
                      <div key={row.path} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{row.path}</div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 break-all">- {row.before}</div>
                          <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 break-all">+ {row.after}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {showAuditRaw && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('audit.before_json')}</div>
                    <pre className="max-h-[220px] overflow-auto text-[11px] text-slate-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedAudit.before ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('audit.after_json')}</div>
                    <pre className="max-h-[220px] overflow-auto text-[11px] text-slate-700 whitespace-pre-wrap">
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
