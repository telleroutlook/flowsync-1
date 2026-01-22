import React from 'react';
import { Task, Priority, TaskStatus } from '../types';

interface ListViewProps {
  tasks: Task[];
}

const priorityColors: Record<Priority, string> = {
  [Priority.LOW]: 'text-green-600 bg-green-50 border-green-200',
  [Priority.MEDIUM]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  [Priority.HIGH]: 'text-red-600 bg-red-50 border-red-200',
};

const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'text-slate-500 bg-slate-100',
  [TaskStatus.IN_PROGRESS]: 'text-blue-600 bg-blue-50',
  [TaskStatus.DONE]: 'text-emerald-600 bg-emerald-50',
};

export const ListView: React.FC<ListViewProps> = ({ tasks }) => {
  // Sort by WBS if available, otherwise createdAt
  const sortedTasks = [...tasks].sort((a, b) => {
      if (a.wbs && b.wbs) return a.wbs.localeCompare(b.wbs, undefined, { numeric: true });
      return a.createdAt - b.createdAt;
  });

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar p-1">
      <div className="min-w-[900px] w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-2 p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
          <div className="col-span-1">WBS</div>
          <div className="col-span-4">Task Name</div>
          <div className="col-span-2">Assignee</div>
          <div className="col-span-1">Progress</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Start</div>
          <div className="col-span-2">Finish</div>
        </div>
        
        {sortedTasks.length === 0 ? (
           <div className="p-8 text-center text-slate-400 italic">No tasks found</div>
        ) : (
          sortedTasks.map((task) => (
            <div key={task.id} className="grid grid-cols-12 gap-2 p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors items-center group text-sm">
              <div className="col-span-1 font-mono text-slate-400 text-xs">{task.wbs || '-'}</div>
              
              <div className="col-span-4">
                <div className={`font-medium ${task.isMilestone ? 'text-accent' : 'text-slate-800'} flex items-center gap-2`}>
                   {task.isMilestone && <span className="text-xs">◆</span>}
                   {task.title}
                </div>
                {task.description && <div className="text-[10px] text-slate-500 truncate mt-0.5">{task.description}</div>}
              </div>

              <div className="col-span-2 text-xs text-slate-500 truncate">
                  {task.assignee || <span className="opacity-30">Unassigned</span>}
              </div>

              <div className="col-span-1 text-xs">
                 <div className="flex items-center gap-2">
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${task.completion || 0}%`}}></div>
                    </div>
                    <span className="text-[10px] w-6 text-right text-slate-600">{task.completion || 0}%</span>
                 </div>
              </div>

              <div className="col-span-1">
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusColors[task.status]}`}>
                  {task.status === TaskStatus.IN_PROGRESS ? 'In Prog' : task.status.replace('_', ' ')}
                </span>
              </div>

              <div className="col-span-1 text-xs text-slate-500">
                {task.startDate ? new Date(task.startDate).toLocaleDateString() : '-'}
              </div>
              
              <div className="col-span-2 text-xs text-slate-500">
                 {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};