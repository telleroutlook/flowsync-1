import React, { useMemo, memo, useCallback } from 'react';
import { Task, Priority, TaskStatus } from '../types';
import { useI18n } from '../src/i18n';
import { getPriorityLabel, getStatusLabel } from '../src/i18n/labels';
import { cn } from '../src/utils/cn';

interface ListViewProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (id: string) => void;
}

// Move constants outside component to avoid recreation
const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.LOW]: 'text-success bg-success/10 border-success/20',
  [Priority.MEDIUM]: 'text-critical bg-critical/10 border-critical/20',
  [Priority.HIGH]: 'text-negative bg-negative/10 border-negative/20',
} as const;

const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'text-text-secondary bg-secondary/10',
  [TaskStatus.IN_PROGRESS]: 'text-primary bg-primary/10',
  [TaskStatus.DONE]: 'text-success bg-success/10',
} as const;

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  locale: string;
  onSelectTask?: (id: string) => void;
  t: ReturnType<typeof useI18n>['t'];
}

const TaskRow = memo(({ task, isSelected, locale, onSelectTask, t }: TaskRowProps) => {
  const handleClick = useCallback(() => {
    onSelectTask?.(task.id);
  }, [onSelectTask, task.id]);

  return (
    <tr
      onClick={handleClick}
      aria-selected={isSelected}
      className={cn(
        "transition-colors group border-b border-border-subtle last:border-0",
        onSelectTask ? "cursor-pointer" : "",
        isSelected ? "bg-primary/5" : "hover:bg-background"
      )}
    >
      <td className="py-3 px-4 text-xs font-mono text-text-secondary">{task.wbs || '-'}</td>
      <td className="py-3 px-4">
         <div className="flex flex-col">
            <span className={cn(
              "text-sm font-medium flex items-center gap-1.5",
              task.isMilestone ? "text-critical" : "text-text-primary"
            )}>
               {task.isMilestone && (
                 <svg className="w-4 h-4 text-critical" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" /></svg>
               )}
               {task.title}
            </span>
            {task.description && (
               <span className="text-xs text-text-secondary truncate max-w-[200px] mt-0.5">{task.description}</span>
            )}
         </div>
      </td>
      <td className="py-3 px-4">
         {task.assignee ? (
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold border border-secondary/20">
                 {task.assignee.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-text-primary truncate max-w-[100px]">{task.assignee}</span>
           </div>
         ) : (
            <span className="text-xs text-text-secondary/50 italic">{t('task.unassigned')}</span>
         )}
      </td>
      <td className="py-3 px-4">
         <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold", PRIORITY_COLORS[task.priority])}>
            {getPriorityLabel(task.priority, t)}
         </span>
      </td>
      <td className="py-3 px-4">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md", STATUS_COLORS[task.status])}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              task.status === TaskStatus.TODO ? "bg-text-secondary" :
              task.status === TaskStatus.IN_PROGRESS ? "bg-primary" : "bg-success"
            )} aria-hidden="true" />
            {getStatusLabel(task.status, t)}
        </span>
      </td>
      <td className="py-3 px-4">
         <div className="flex items-center gap-3 w-full max-w-[140px]">
            <div className="flex-1 bg-secondary/10 h-1.5 rounded-full overflow-hidden">
               <div 
                 className={cn("h-full rounded-full transition-all duration-500", task.completion === 100 ? "bg-success" : "bg-primary")} 
                 style={{ width: `${task.completion || 0}%`}} 
                 aria-label={`${task.completion || 0}% complete`} 
               />
            </div>
            <span className="text-xs w-8 text-right text-text-secondary font-mono">{task.completion || 0}%</span>
         </div>
      </td>
      <td className="py-3 px-4 text-xs text-text-secondary">
         {task.startDate ? new Date(task.startDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : '-'}
      </td>
      <td className="py-3 px-4 text-xs text-text-secondary font-medium">
         {task.dueDate ? (
           <span className={task.dueDate < Date.now() && task.status !== TaskStatus.DONE ? 'text-negative' : ''}>
              {new Date(task.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
           </span>
         ) : '-'}
      </td>
    </tr>
  );
});
TaskRow.displayName = 'TaskRow';

export const ListView: React.FC<ListViewProps> = memo(({ tasks, selectedTaskId, onSelectTask }) => {
  const { t, locale } = useI18n();

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.wbs && b.wbs) return a.wbs.localeCompare(b.wbs, undefined, { numeric: true });
      return a.createdAt - b.createdAt;
    });
  }, [tasks]);

  return (
    <div className="w-full h-full overflow-hidden bg-surface border border-border-subtle rounded-xl shadow-sm flex flex-col">
       <div className="overflow-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background sticky top-0 z-10 border-b border-border-subtle">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-16">{t('list.header.wbs')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider min-w-[240px]">{t('list.header.task_name')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-40">{t('list.header.assignee')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-28">{t('list.header.priority')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-32">{t('list.header.status')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-40">{t('list.header.progress')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-28">{t('list.header.start')}</th>
              <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-28">{t('list.header.due')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sortedTasks.length === 0 ? (
               <tr>
                 <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                       <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                       </div>
                       <span className="text-sm text-text-secondary">{t('list.empty')}</span>
                    </div>
                 </td>
               </tr>
            ) : (
              sortedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  locale={locale}
                  onSelectTask={onSelectTask}
                  t={t}
                />
              ))
            )}
          </tbody>
        </table>
       </div>
    </div>
  );
});
ListView.displayName = 'ListView';
