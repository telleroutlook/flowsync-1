import React from 'react';
import { Project } from '../types';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  showChatToggle?: boolean;
  onToggleChat?: () => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  showChatToggle,
  onToggleChat
}) => {
  return (
    <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-10 flex flex-col">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
           {showChatToggle && (
             <button 
               onClick={onToggleChat}
               className="text-slate-400 hover:text-indigo-600 transition-colors"
               title="Open Chat AI"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
             </button>
           )}
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Projects</h3>
        </div>
        <button 
          onClick={onCreateProject}
          className="text-slate-400 hover:text-primary hover:bg-indigo-50 transition-all p-1.5 rounded-md"
          title="Create New Project"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          return (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 border ${
                isActive 
                  ? 'bg-indigo-50/60 text-indigo-700 border-indigo-100/50 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 border-transparent hover:border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-sm shadow-sm transition-transform group-hover:scale-105 ${
                  isActive ? 'bg-white text-indigo-600 ring-1 ring-indigo-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {project.icon || project.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex flex-col min-w-0">
                   <span className="truncate text-sm font-medium leading-tight">{project.name}</span>
                   {project.description && (
                     <span className="truncate text-[10px] text-slate-400 leading-tight mt-0.5">{project.description}</span>
                   )}
                </div>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm(`Delete project "${project.name}"?`)) onDeleteProject(project.id);
                }}
                className={`opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all ${isActive ? 'text-indigo-400' : ''}`}
                title="Delete Project"
              >
                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
              </button>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
         <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <div className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">💡</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                   <strong>Pro Tip:</strong> Try asking FlowSync to "Create a Marketing project" to instantly set up a workspace.
                </p>
            </div>
         </div>
      </div>
    </div>
  );
};