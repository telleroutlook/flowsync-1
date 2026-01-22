import React, { useMemo } from 'react';
import { Task, TaskStatus, Priority } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
}

const statusMap: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.DONE]: 'Done',
};

const priorityColors: Record<Priority, string> = {
  [Priority.LOW]: 'bg-green-100 text-green-700 border-green-200',
  [Priority.MEDIUM]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [Priority.HIGH]: 'bg-red-100 text-red-700 border-red-200',
};

const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
  <div className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer group animate-slide-up ${task.isMilestone ? 'border-accent/50 bg-purple-50' : 'border-slate-200 hover:border-primary/50'}`}>
    <div className="flex justify-between items-start mb-1">
      <div className="flex flex-col">
          {task.wbs && <span className="text-[9px] font-mono text-slate-400 mb-0.5">{task.wbs}</span>}
          <h4 className={`font-medium text-sm ${task.isMilestone ? 'text-accent font-bold' : 'text-slate-800'}`}>
             {task.isMilestone && '◆ '} {task.title}
          </h4>
      </div>
      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${priorityColors[task.priority]}`}>
        {task.priority}
      </span>
    </div>
    
    {task.description && (
      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{task.description}</p>
    )}

    {/* Progress Bar */}
    <div className="mb-3">
        <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
            <span>Progress</span>
            <span>{task.completion || 0}%</span>
        </div>
        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
             <div className="bg-primary h-full rounded-full" style={{ width: `${task.completion || 0}%`}}></div>
        </div>
    </div>

    <div className="flex justify-between items-end border-t border-slate-100 pt-2">
      <div className="flex flex-col gap-0.5">
         {task.assignee && (
             <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded inline-block max-w-[100px] truncate font-medium">
                {task.assignee}
             </span>
         )}
         {task.startDate && (
             <span className="text-[9px] text-slate-400">
                Start: {new Date(task.startDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
             </span>
         )}
      </div>
      <span className="text-[9px] text-slate-400">
         Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}) : '-'}
      </span>
    </div>
  </div>
);

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks }) => {
  const groupedTasks = useMemo(() => {
    const groups = {
      [TaskStatus.TODO]: [] as Task[],
      [TaskStatus.IN_PROGRESS]: [] as Task[],
      [TaskStatus.DONE]: [] as Task[],
    };
    tasks.forEach((t) => {
      if (groups[t.status]) {
        groups[t.status].push(t);
      }
    });
    return groups;
  }, [tasks]);

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-4 h-full">
      {(Object.keys(statusMap) as TaskStatus[]).map((status) => (
        <div key={status} className="flex-1 min-w-[280px] flex flex-col bg-slate-100/50 rounded-xl border border-slate-200">
          <div className="p-3 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-slate-50/95 backdrop-blur-sm rounded-t-xl z-10">
            <h3 className="font-semibold text-slate-600 text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                status === TaskStatus.TODO ? 'bg-slate-400' : 
                status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-green-500'
              }`}></span>
              {statusMap[status]}
            </h3>
            <span className="bg-white border border-slate-200 text-slate-500 text-xs px-2 py-0.5 rounded-full shadow-sm">
              {groupedTasks[status].length}
            </span>
          </div>
          
          <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1 custom-scrollbar">
            {groupedTasks[status].length === 0 ? (
              <div className="text-center py-8 opacity-40 text-sm italic text-slate-500">
                No tasks
              </div>
            ) : (
              groupedTasks[status].map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};