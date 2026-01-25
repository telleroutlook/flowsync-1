import React from 'react';
import { Task, Priority, TaskStatus } from '../types';
import { useI18n } from '../src/i18n';
import { getPriorityLabel, getStatusLabel } from '../src/i18n/labels';

interface ListViewProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  [Priority.LOW]: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  [Priority.MEDIUM]: 'text-amber-700 bg-amber-50 border-amber-100',
  [Priority.HIGH]: 'text-rose-700 bg-rose-50 border-rose-100',
};

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'text-slate-500 bg-slate-100',
  [TaskStatus.IN_PROGRESS]: 'text-indigo-600 bg-indigo-50',
  [TaskStatus.DONE]: 'text-emerald-600 bg-emerald-50',
};

export const ListView: React.FC<ListViewProps> = ({ tasks, selectedTaskId, onSelectTask }) => {
  const { t, locale } = useI18n();
  // Sort by WBS if available, otherwise createdAt
  const sortedTasks = [...tasks].sort((a, b) => {
      if (a.wbs && b.wbs) return a.wbs.localeCompare(b.wbs, undefined, { numeric: true });
      return a.createdAt - b.createdAt;
  });

  return (
    <div className="w-full h-full overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
       <div className="overflow-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16">{t('list.header.wbs')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[200px]">{t('list.header.task_name')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">{t('list.header.assignee')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">{t('list.header.priority')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">{t('list.header.status')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">{t('list.header.progress')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">{t('list.header.start')}</th>
              <th className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">{t('list.header.due')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTasks.length === 0 ? (
               <tr>
                 <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                          <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                       </div>
                       <span className="text-xs text-slate-400 italic">{t('list.empty')}</span>
                    </div>
                 </td>
               </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask?.(task.id)}
                  aria-selected={selectedTaskId === task.id}
                  className={`transition-colors group ${onSelectTask ? 'cursor-pointer' : ''} ${
                    selectedTaskId === task.id ? 'bg-indigo-50/70' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="py-2 px-3 text-[11px] font-mono text-slate-400">{task.wbs || '-'}</td>
                  <td className="py-2 px-3">
                     <div className="flex flex-col">
                        <span className={`text-xs font-medium flex items-center gap-1.5 ${task.isMilestone ? 'text-amber-700' : 'text-slate-700'}`}>
                           {task.isMilestone && (
                             <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" /></svg>
                           )}
                           {task.title}
                        </span>
                        {task.description && (
                           <span className="text-[9px] text-slate-400 truncate max-w-[200px] mt-0.5">{task.description}</span>
                        )}
                     </div>
                  </td>
                  <td className="py-2 px-3">
                     {task.assignee ? (
                       <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold">
                             {task.assignee.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[11px] text-slate-600 truncate max-w-[100px]">{task.assignee}</span>
                       </div>
                     ) : (
                        <span className="text-[10px] text-slate-300 italic">{t('task.unassigned')}</span>
                     )}
                  </td>
                  <td className="py-2 px-3">
                     <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${priorityColors[task.priority]}`}>
                        {getPriorityLabel(task.priority, t)}
                     </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`flex items-center gap-1.5 text-[11px] font-medium ${statusColors[task.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${task.status === TaskStatus.TODO ? 'bg-slate-400' : task.status === TaskStatus.IN_PROGRESS ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                        {getStatusLabel(task.status, t)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                     <div className="flex items-center gap-2 w-full max-w-[120px]">
                        <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                           <div className={`h-full rounded-full ${task.completion === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${task.completion || 0}%`}}></div>
                        </div>
                        <span className="text-[10px] w-6 text-right text-slate-500">{task.completion || 0}%</span>
                     </div>
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-500">
                     {task.startDate ? new Date(task.startDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : '-'}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-500 font-medium">
                     {task.dueDate ? (
                       <span className={task.dueDate < Date.now() && task.status !== TaskStatus.DONE ? 'text-rose-600' : ''}>
                          {new Date(task.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                       </span>
                     ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
       </div>
    </div>
  );
};
