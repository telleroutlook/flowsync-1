import React from 'react';
import { Project } from '../types';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject
}) => {
  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-10">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Projects</h3>
        <button 
          onClick={onCreateProject}
          className="text-slate-400 hover:text-primary transition-colors p-1 rounded hover:bg-slate-50"
          title="Create New Project"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          return (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs ${
                  isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {project.icon || project.name.charAt(0)}
                </span>
                <span className="truncate text-sm">{project.name}</span>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm(`Delete project "${project.name}"?`)) onDeleteProject(project.id);
                }}
                className={`opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity ${isActive ? 'text-indigo-400' : ''}`}
              >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
              </button>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-slate-200">
         <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-3 border border-indigo-100">
            <p className="text-[10px] text-slate-500 leading-tight">
               <strong className="text-indigo-600">Pro Tip:</strong> Tell FlowSync "Create a Marketing project" to instantly set up a new workspace.
            </p>
         </div>
      </div>
    </div>
  );
};