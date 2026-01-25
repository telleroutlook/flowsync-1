import React from 'react';
import { Project } from '../types';
import { useI18n } from '../src/i18n';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onClose: () => void;
}

export const ProjectSidebar = React.memo<ProjectSidebarProps>(({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onClose,
}) => {
  const { t } = useI18n();

  return (
    <div className="w-full bg-white flex flex-col h-full shrink-0 shadow-sm z-10 flex flex-col">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t('app.sidebar.projects')}</h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={onCreateProject}
            className="text-slate-400 hover:text-primary hover:bg-indigo-50 transition-all p-1 rounded-md"
            title={t('app.sidebar.create')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
            title={t('app.sidebar.collapse')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          return (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200 border ${
                isActive 
                  ? 'bg-indigo-50/60 text-indigo-700 border-indigo-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 border-transparent hover:border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs shadow-sm transition-transform group-hover:scale-105 ${
                  isActive ? 'bg-white text-indigo-600 ring-1 ring-indigo-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {project.icon || project.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex flex-col min-w-0">
                   <span className="truncate text-xs font-medium leading-tight">{project.name}</span>
                   {project.description && (
                     <span className="truncate text-[9px] text-slate-400 leading-tight mt-0.5">{project.description}</span>
                   )}
                </div>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(t('app.sidebar.delete_confirm', { name: project.name }))) onDeleteProject(project.id);
                }}
                className={`opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all ${isActive ? 'text-indigo-400' : ''}`}
                title={t('app.sidebar.delete')}
              >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
              </button>
            </div>
          );
        })}
      </div>
      
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
         <div className="bg-white rounded-lg p-2 border border-slate-200 shadow-sm">
            <div className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 text-xs">💡</span>
                <p className="text-[10px] text-slate-500 leading-snug">
                   {t('app.sidebar.tip')}
                </p>
            </div>
         </div>
      </div>
    </div>
  );
});
