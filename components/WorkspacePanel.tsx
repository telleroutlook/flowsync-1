import React from 'react';
import type { User, WorkspaceWithMembership } from '../types';
import { useI18n } from '../src/i18n';

interface WorkspacePanelProps {
  user: User | null;
  workspaces: WorkspaceWithMembership[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void | Promise<void>;
  onOpenManage: () => void;
  onOpenProfile: () => void;
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  user,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenLogin,
  onLogout,
  onOpenManage,
  onOpenProfile,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      {/* User Info Section */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 overflow-hidden">
           <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm ${
             user ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
           }`}>
             {user ? user.username.charAt(0).toUpperCase() : '?'}
           </div>
           <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-700 truncate">
                {user ? user.username : t('auth.guest')}
              </span>
              <button
                onClick={onOpenProfile}
                className="text-[10px] text-slate-400 hover:text-indigo-500 text-left transition-colors truncate"
              >
                {t('profile.open')}
              </button>
           </div>
        </div>

        <div>
          {user ? (
            <button
              type="button"
              onClick={() => {
                void onLogout();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all"
              title={t('auth.logout')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {t('auth.login')}
            </button>
          )}
        </div>
      </div>

      {/* Workspace Selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
          {t('workspace.title')}
        </label>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <select
              value={activeWorkspaceId}
              onChange={(event) => onSelectWorkspace(event.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-indigo-300 transition-all shadow-sm cursor-pointer"
              aria-label={t('workspace.select')}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}{workspace.isPublic ? ` (${t('workspace.public')})` : ''}
                </option>
              ))}
            </select>
             <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {user && (
            <button
              type="button"
              onClick={onOpenManage}
              className="flex items-center justify-center w-8 h-[34px] rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
              title={t('workspace.manage')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};