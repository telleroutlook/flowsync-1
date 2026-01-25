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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-600">{t('workspace.title')}</span>
          <span className="text-[11px] text-slate-400">
            {user ? t('auth.signed_in_as', { name: user.username }) : t('auth.guest')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600"
          >
            {t('profile.open')}
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => {
                void onLogout();
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-rose-500"
            >
              {t('auth.logout')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              {t('auth.login')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={activeWorkspaceId}
          onChange={(event) => onSelectWorkspace(event.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={t('workspace.select')}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}{workspace.isPublic ? ` (${t('workspace.public')})` : ''}
            </option>
          ))}
        </select>
        {user && (
          <button
            type="button"
            onClick={onOpenManage}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 hover:text-indigo-600"
          >
            {t('workspace.manage')}
          </button>
        )}
      </div>
    </div>
  );
};
