import React, { useMemo, memo, useCallback } from 'react';
import { Task, TaskStatus, Priority } from '../types';
import { useI18n } from '../src/i18n';
import { getPriorityShortLabel, getStatusLabel } from '../src/i18n/labels';

interface KanbanBoardProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  [Priority.LOW]: 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-200',
  [Priority.MEDIUM]: 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-200',
  [Priority.HIGH]: 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-200',
};

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = memo(({ task, isSelected, onSelect }) => {
  const { t, locale } = useI18n();

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!onSelect) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(task.id);
    }
  }, [onSelect, task.id]);

  const handleClick = useCallback(() => {
    onSelect?.(task.id);
  }, [onSelect, task.id]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`bg-white p-4 rounded-xl border transition-all duration-200 cursor-pointer group animate-fade-in relative overflow-hidden ${
        isSelected
          ? 'border-indigo-300 ring-2 ring-indigo-200 shadow-[0_6px_18px_-12px_rgba(99,102,241,0.6)]'
          : task.isMilestone
            ? 'border-amber-200/50 shadow-[0_4px_20px_-12px_rgba(251,191,36,0.5)] ring-1 ring-amber-100'
            : 'border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-200/60 hover:-translate-y-0.5'
      }`}
    >
      {task.isMilestone && (
        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-amber-100 to-transparent -mr-4 -mt-4 rotate-45" aria-hidden="true" />
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
          {task.wbs && <span className="text-[10px] font-mono text-slate-400 tracking-tight">WBS: {task.wbs}</span>}
          <h4 className={`font-semibold text-base leading-snug break-words ${task.isMilestone ? 'text-slate-900' : 'text-slate-800'}`}>
            {task.title}
          </h4>
        </div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ring-1 ring-inset ${priorityColors[task.priority]}`}>
          {getPriorityShortLabel(task.priority, t)}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{task.description}</p>
      )}

      {/* Progress Bar */}
      <div className="mb-3 group-hover:opacity-100 transition-opacity">
        <div className="flex justify-between text-xs text-slate-400 mb-1 font-medium">
          <span>{t('kanban.progress')}</span>
          <span className={task.completion === 100 ? 'text-emerald-600' : ''}>{task.completion || 0}%</span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${task.completion === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${task.completion || 0}%`}}
            aria-label={`${task.completion || 0}% complete`}
          />
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-slate-50 pt-2.5 mt-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.assignee ? (
            <div className="flex items-center gap-1.5 bg-indigo-50/50 pr-2 py-0.5 rounded-full border border-indigo-100/50">
              <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold">
                {task.assignee.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-indigo-900 truncate max-w-[80px] font-medium">
                {task.assignee}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-300 italic">{t('task.unassigned')}</span>
          )}
        </div>

        {task.dueDate && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
              task.dueDate < Date.now() && task.status !== TaskStatus.DONE
              ? 'text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded'
              : 'text-slate-400'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(task.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
});
TaskCard.displayName = 'TaskCard';

export const KanbanBoard: React.FC<KanbanBoardProps> = memo(({ tasks, selectedTaskId, onSelectTask }) => {
  const { t } = useI18n();

  const groupedTasks = useMemo(() => {
    const groups = {
      [TaskStatus.TODO]: [] as Task[],
      [TaskStatus.IN_PROGRESS]: [] as Task[],
      [TaskStatus.DONE]: [] as Task[],
    };
    tasks.forEach((task) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    });
    return groups;
  }, [tasks]);

  return (
    <div className="flex flex-1 gap-6 overflow-x-auto pb-2 h-full snap-x">
      {([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE] as TaskStatus[]).map((status) => (
        <div key={status} className="flex-1 min-w-[300px] flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100/60 shadow-inner snap-center">
          <div className="p-4 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-bold text-slate-700 text-base flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-md ${
                status === TaskStatus.TODO ? 'bg-slate-300' :
                status === TaskStatus.IN_PROGRESS ? 'bg-indigo-500 shadow-sm shadow-indigo-200' : 'bg-emerald-500 shadow-sm shadow-emerald-200'
              }`} aria-hidden="true" />
              {getStatusLabel(status, t)}
            </h3>
            <span className="bg-white border border-slate-200 text-slate-400 font-mono text-xs px-2 py-0.5 rounded-full shadow-sm" aria-label={`${groupedTasks[status].length} tasks`}>
              {groupedTasks[status].length}
            </span>
          </div>

          <div className="p-3 pt-0 flex flex-col gap-3 overflow-y-auto flex-1 custom-scrollbar pb-4">
            {groupedTasks[status].length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200/60 rounded-xl m-1 bg-slate-50/30">
                 <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                 </div>
                 <p className="text-sm font-semibold text-slate-500">{t('kanban.empty_title')}</p>
                 <p className="text-xs text-slate-400 mt-1">{t('kanban.empty_subtitle')}</p>
              </div>
            ) : (
              groupedTasks[status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onSelect={onSelectTask}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
KanbanBoard.displayName = 'KanbanBoard';
