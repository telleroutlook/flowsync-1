import React, { memo, useCallback } from 'react';
import { Project } from '../types';
import { useI18n } from '../src/i18n';
import { cn } from '../src/utils/cn';
import { Button } from './ui/Button';
import { Plus, ChevronLeft, Trash2, Lightbulb } from 'lucide-react';

interface ProjectSidebarProps {
  topSlot?: React.ReactNode;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onClose: () => void;
}

export const ProjectSidebar = memo<ProjectSidebarProps>(({
  topSlot,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onClose,
}) => {
  const { t } = useI18n();

  const handleDeleteProject = useCallback((event: React.MouseEvent, id: string, name: string) => {
    event.stopPropagation();
    if (confirm(t('app.sidebar.delete_confirm', { name }))) {
      onDeleteProject(id);
    }
  }, [t, onDeleteProject]);

  return (
    <div className="w-full bg-background flex flex-col h-full shrink-0 shadow-sm z-10">
      {topSlot && (
        <div className="p-3 border-b border-border-subtle bg-surface/50 backdrop-blur-sm">
          {topSlot}
        </div>
      )}
      <div className="p-3 border-b border-border-subtle flex items-center justify-between bg-surface/50 backdrop-blur-sm z-10">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">{t('app.sidebar.projects')}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateProject}
            className="h-8 w-8 text-text-secondary hover:text-primary"
            title={t('app.sidebar.create')}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="h-8 w-8 text-text-secondary hover:text-text-primary"
            title={t('app.sidebar.collapse')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={cn(
                "group flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 border",
                isActive
                  ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                  : "text-text-secondary hover:bg-surface border-transparent hover:border-border-subtle"
              )}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectProject(project.id);
                }
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className={cn(
                  "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-sm font-semibold shadow-sm transition-transform group-hover:scale-105",
                  isActive ? "bg-surface text-primary ring-1 ring-primary/20" : "bg-surface text-text-secondary ring-1 ring-border-subtle"
                )} aria-hidden="true">
                  {project.icon || project.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex flex-col min-w-0">
                   <span className="truncate text-sm font-medium leading-tight">{project.name}</span>
                   {project.description && (
                     <span className="truncate text-[10px] text-text-secondary/80 leading-tight mt-0.5">{project.description}</span>
                   )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                className={cn(
                  "h-7 w-7 opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error hover:bg-error/10 transition-all",
                  isActive && "text-primary/60 hover:text-error"
                )}
                title={t('app.sidebar.delete')}
              >
                 <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-border-subtle bg-surface/30">
         <a 
           href={`mailto:teller.lin@sap.com?subject=${encodeURIComponent(t('app.sidebar.tip.subject'))}`}
           className="bg-surface rounded-lg p-3 border border-border-subtle shadow-sm flex items-start gap-2 hover:bg-surface-active transition-colors cursor-pointer group/tip"
         >
            <Lightbulb className="w-4 h-4 text-accent mt-0.5 group-hover/tip:scale-110 transition-transform" />
            <p className="text-xs text-text-secondary leading-snug group-hover/tip:text-text-primary transition-colors">
               {t('app.sidebar.tip')}
            </p>
         </a>
      </div>
    </div>
  );
});
ProjectSidebar.displayName = 'ProjectSidebar';
