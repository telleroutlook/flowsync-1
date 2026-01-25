import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../src/i18n';
import type { WorkspaceJoinRequest, WorkspaceMember, WorkspaceWithMembership } from '../types';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: WorkspaceWithMembership[];
  pendingRequests: WorkspaceJoinRequest[];
  members: WorkspaceMember[];
  activeWorkspaceId: string;
  onCreate: (name: string, description?: string) => Promise<unknown> | void;
  onRequestJoin: (workspaceId: string) => Promise<unknown> | void;
  onApprove: (workspaceId: string, userId: string) => Promise<unknown> | void;
  onReject: (workspaceId: string, userId: string) => Promise<unknown> | void;
  onRemoveMember: (workspaceId: string, userId: string) => Promise<unknown> | void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  workspaces,
  pendingRequests,
  members,
  activeWorkspaceId,
  onCreate,
  onRequestJoin,
  onApprove,
  onReject,
  onRemoveMember,
}) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
    }
  }, [isOpen]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  if (!isOpen) return null;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
    } catch {
      // keep form open on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{t('workspace.manage')}</h3>
            {activeWorkspace && (
              <p className="text-xs text-slate-500">{t('workspace.active')}: {activeWorkspace.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">{t('workspace.all')}</h4>
            <div className="space-y-2">
              {workspaces.map((workspace) => {
                const membership = workspace.membership;
                const status = membership?.status;
                const role = membership?.role;
                const isActive = workspace.id === activeWorkspaceId;
                const actionLabel = status === 'active'
                  ? (role === 'admin' ? t('workspace.role_admin') : t('workspace.role_member'))
                  : status === 'pending'
                    ? t('workspace.pending')
                    : workspace.isPublic
                      ? t('workspace.public')
                      : t('workspace.request_join');
                return (
                  <div
                    key={workspace.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isActive ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{workspace.name}</p>
                      {workspace.description && (
                        <p className="text-xs text-slate-400 truncate">{workspace.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(status === 'active' || status === 'pending' || workspace.isPublic) ? (
                        <span className="text-[11px] font-semibold text-slate-500">{actionLabel}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void onRequestJoin(workspace.id);
                          }}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600"
                        >
                          {actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {activeWorkspace?.membership?.role === 'admin' && activeWorkspace?.membership?.status === 'active' && (
            <>
              {pendingRequests.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">{t('workspace.pending_requests')}</h4>
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div key={request.userId} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{request.username}</p>
                          <p className="text-[11px] text-slate-400">{t('workspace.requested')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void onApprove(activeWorkspaceId, request.userId);
                            }}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            {t('workspace.approve')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void onReject(activeWorkspaceId, request.userId);
                            }}
                            className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            {t('workspace.reject')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {members.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">{t('workspace.members')}</h4>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.userId} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{member.username}</p>
                          <p className="text-[11px] text-slate-400">
                            {member.role === 'admin' ? t('workspace.role_admin') : t('workspace.role_member')}
                          </p>
                        </div>
                        {member.role === 'member' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(t('workspace.remove_confirm', { name: member.username }))) {
                                void onRemoveMember(activeWorkspaceId, member.userId);
                              }
                            }}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-rose-600 hover:border-rose-200"
                          >
                            {t('workspace.remove')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">{t('workspace.create')}</h4>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('workspace.name_placeholder')}
                required
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder={t('workspace.description_placeholder')}
                rows={2}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!name.trim() || isSubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('workspace.create')}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
