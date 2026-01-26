import React, { useEffect, useMemo, useState, memo } from 'react';
import { useI18n } from '../src/i18n';
import type { WorkspaceJoinRequest, WorkspaceMember, WorkspaceWithMembership } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '../src/utils/cn';
import { X, Check, Trash2, Plus, Users, Globe, Clock, Shield, Briefcase, UserPlus } from 'lucide-react';

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

const WorkspaceModal = ({
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
}: WorkspaceModalProps) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-primary/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-border-subtle">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle bg-surface sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-text-primary tracking-tight">{t('workspace.manage')}</h3>
            {activeWorkspace && (
              <p className="text-sm text-text-secondary mt-1 font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success inline-block"></span>
                {activeWorkspace.name}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-border-subtle space-x-6 bg-background/50">
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "py-3 text-sm font-medium border-b-2 transition-all",
              activeTab === 'list' 
                ? "border-primary text-primary" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {t('workspace.all')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                "py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
                activeTab === 'members' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              {t('workspace.members')}
              {pendingRequests.length > 0 && (
                <span className="bg-critical/10 text-critical border border-critical/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "py-3 text-sm font-medium border-b-2 transition-all",
              activeTab === 'create' 
                ? "border-primary text-primary" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {t('workspace.create')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background/30">
          {activeTab === 'list' && (
            <div className="space-y-3">
              {workspaces.map((workspace) => {
                const membership = workspace.membership;
                const status = membership?.status;
                const role = membership?.role;
                const isActive = workspace.id === activeWorkspaceId;
                
                let badgeClass = 'bg-secondary/10 text-text-secondary';
                let actionLabel = '';
                
                if (status === 'active') {
                   badgeClass = role === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-success/10 text-success border border-success/20';
                   actionLabel = role === 'admin' ? t('workspace.role_admin') : t('workspace.role_member');
                } else if (status === 'pending') {
                   badgeClass = 'bg-critical/10 text-critical border border-critical/20';
                   actionLabel = t('workspace.pending');
                } else if (workspace.isPublic) {
                   badgeClass = 'bg-secondary/10 text-text-secondary border border-border-subtle';
                   actionLabel = t('workspace.public');
                } else {
                   actionLabel = t('workspace.request_join');
                }

                return (
                  <div
                    key={workspace.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all",
                      isActive 
                        ? "border-primary/30 bg-primary/5 shadow-sm ring-1 ring-primary/10" 
                        : "border-border-subtle bg-surface hover:border-primary/20 hover:shadow-sm"
                    )}
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-base font-bold text-text-primary truncate">{workspace.name}</h4>
                        {isActive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {t('workspace.active')}
                          </span>
                        )}
                      </div>
                      {workspace.description && (
                        <p className="text-sm text-text-secondary truncate">{workspace.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {(status === 'active' || status === 'pending' || workspace.isPublic && status) ? (
                        <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", badgeClass)}>
                          {actionLabel}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onRequestJoin(workspace.id)}
                          className="h-8 text-xs font-semibold"
                        >
                          {actionLabel}
                        </Button>
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
                  <h4 className="text-xs font-bold text-critical uppercase tracking-widest mb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    {t('workspace.pending_requests')}
                  </h4>
                  <div className="grid gap-2">
                    {pendingRequests.map((request) => (
                      <div key={request.userId} className="flex items-center justify-between p-3 rounded-lg border border-critical/20 bg-critical/5">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-critical/10 flex items-center justify-center text-critical font-bold text-xs ring-1 ring-critical/20">
                             {request.username.charAt(0).toUpperCase()}
                           </div>
                           <div>
                            <p className="text-sm font-semibold text-text-primary">{request.username}</p>
                            <p className="text-[10px] text-text-secondary">{t('workspace.requested')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void onApprove(activeWorkspaceId, request.userId)}
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            title={t('workspace.approve')}
                          >
                             <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void onReject(activeWorkspaceId, request.userId)}
                            className="h-8 w-8 text-negative hover:text-negative hover:bg-negative/10"
                            title={t('workspace.reject')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Users className="w-4 h-4" />
                   {t('workspace.members')}
                </h4>
                <div className="bg-surface rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                  {members.map((member) => (
                    <div key={member.userId} className="flex items-center justify-between p-3 hover:bg-background transition-colors">
                      <div className="flex items-center gap-3">
                           <div className={cn(
                             "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-1",
                             member.role === 'admin' 
                               ? "bg-primary/10 text-primary ring-primary/20" 
                               : "bg-secondary/10 text-text-secondary ring-border-subtle"
                           )}>
                           {member.username.charAt(0).toUpperCase()}
                         </div>
                        <div>
                          <p className="text-base font-semibold text-text-primary">{member.username}</p>
                          <p className="text-xs text-text-secondary">
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
                          className="text-xs font-medium text-text-secondary hover:text-negative transition-colors px-2 py-1"
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
                 <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3 ring-1 ring-primary/20">
                    <Plus className="w-6 h-6" />
                 </div>
                 <h4 className="text-base font-bold text-text-primary">{t('workspace.create_new')}</h4>
                 <p className="text-xs text-text-secondary mt-1">{t('workspace.create_desc')}</p>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wide">
                    {t('workspace.name')}
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('workspace.name_placeholder')}
                    required
                  />
                </div>
                <div>
                   <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wide">
                    {t('workspace.description')} <span className="text-text-secondary/50 font-normal lowercase">({t('common.optional')})</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className={cn(
                      "flex min-h-[80px] w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm ring-offset-background placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm"
                    )}
                    placeholder={t('workspace.description_placeholder')}
                    rows={3}
                  />
                </div>
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    isLoading={isSubmitting}
                    className="w-full font-bold shadow-md hover:shadow-lg"
                  >
                    {t('workspace.create')}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(WorkspaceModal);