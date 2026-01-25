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
  const [activeTab, setActiveTab] = useState<'list' | 'members' | 'create'>('list');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setActiveTab('list');
    }
  }, [isOpen]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  const isAdmin = activeWorkspace?.membership?.role === 'admin' && activeWorkspace?.membership?.status === 'active';

  if (!isOpen) return null;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      setActiveTab('list');
    } catch {
      // keep form open on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('workspace.manage')}</h3>
            {activeWorkspace && (
              <p className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                {activeWorkspace.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-100"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-100 space-x-6 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'list' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('workspace.all')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('members')}
              className={`py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'members' 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('workspace.members')}
              {pendingRequests.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('create')}
            className={`py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'create' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('workspace.create')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === 'list' && (
            <div className="space-y-3">
              {workspaces.map((workspace) => {
                const membership = workspace.membership;
                const status = membership?.status;
                const role = membership?.role;
                const isActive = workspace.id === activeWorkspaceId;
                
                let badgeClass = 'bg-slate-100 text-slate-600';
                let actionLabel = '';
                
                if (status === 'active') {
                   badgeClass = role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700';
                   actionLabel = role === 'admin' ? t('workspace.role_admin') : t('workspace.role_member');
                } else if (status === 'pending') {
                   badgeClass = 'bg-amber-100 text-amber-700';
                   actionLabel = t('workspace.pending');
                } else if (workspace.isPublic) {
                   badgeClass = 'bg-sky-100 text-sky-700';
                   actionLabel = t('workspace.public');
                } else {
                   actionLabel = t('workspace.request_join');
                }

                return (
                  <div
                    key={workspace.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isActive 
                        ? 'border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-50' 
                        : 'border-slate-200 bg-white hover:border-indigo-100 hover:shadow-sm'
                    }`}
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-base font-bold text-slate-800 truncate">{workspace.name}</h4>
                        {isActive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {t('workspace.active')}
                          </span>
                        )}
                      </div>
                      {workspace.description && (
                        <p className="text-sm text-slate-500 truncate">{workspace.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {(status === 'active' || status === 'pending' || workspace.isPublic && status) ? (
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                          {actionLabel}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void onRequestJoin(workspace.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                        >
                          {actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'members' && isAdmin && (
            <div className="space-y-8">
              {pendingRequests.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t('workspace.pending_requests')}
                  </h4>
                  <div className="grid gap-2">
                    {pendingRequests.map((request) => (
                      <div key={request.userId} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                             {request.username.charAt(0).toUpperCase()}
                           </div>
                           <div>
                            <p className="text-sm font-semibold text-slate-700">{request.username}</p>
                            <p className="text-[10px] text-slate-500">{t('workspace.requested')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void onApprove(activeWorkspaceId, request.userId)}
                            className="p-1.5 rounded-md bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
                            title={t('workspace.approve')}
                          >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button
                            onClick={() => void onReject(activeWorkspaceId, request.userId)}
                            className="p-1.5 rounded-md bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-sm"
                            title={t('workspace.reject')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                   {t('workspace.members')}
                </h4>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {members.map((member) => (
                    <div key={member.userId} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                           member.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                         }`}>
                           {member.username.charAt(0).toUpperCase()}
                         </div>
                        <div>
                          <p className="text-base font-semibold text-slate-700">{member.username}</p>
                          <p className="text-xs text-slate-400">
                            {member.role === 'admin' ? t('workspace.role_admin') : t('workspace.role_member')}
                          </p>
                        </div>
                      </div>
                      {member.role === 'member' && (
                        <button
                          onClick={() => {
                            if (confirm(t('workspace.remove_confirm', { name: member.username }))) {
                              void onRemoveMember(activeWorkspaceId, member.userId);
                            }
                          }}
                          className="text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors px-2 py-1"
                        >
                          {t('workspace.remove')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="max-w-md mx-auto py-4">
              <div className="text-center mb-6">
                 <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                 </div>
                 <h4 className="text-base font-bold text-slate-800">{t('workspace.create_new')}</h4>
                 <p className="text-xs text-slate-500 mt-1">{t('workspace.create_desc')}</p>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                    {t('workspace.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                    placeholder={t('workspace.name_placeholder')}
                    required
                  />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                    {t('workspace.description')} <span className="text-slate-400 font-normal lowercase">({t('common.optional')})</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm resize-none"
                    placeholder={t('workspace.description_placeholder')}
                    rows={3}
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    {isSubmitting ? t('common.processing') : t('workspace.create')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};