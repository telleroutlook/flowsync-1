import React, { useMemo, memo, useCallback } from 'react';
import { Task, TaskStatus, Priority } from '../types';
import { useI18n } from '../src/i18n';
import { getPriorityShortLabel, getStatusLabel } from '../src/i18n/labels';
import { cn } from '../src/utils/cn';
import { ClipboardList, Calendar } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (id: string) => void;
}

// Move constants outside component to avoid recreation
const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.LOW]: 'bg-success/10 text-success border-success/20 ring-success/30',
  [Priority.MEDIUM]: 'bg-warning/10 text-warning border-warning/20 ring-warning/30',
  [Priority.HIGH]: 'bg-negative/10 text-negative border-negative/20 ring-negative/30',
} as const;

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
      className={cn(
        "bg-surface p-4 rounded-xl border transition-all duration-200 cursor-pointer group animate-fade-in relative overflow-hidden",
        isSelected
          ? 'border-primary/50 ring-2 ring-primary/20 shadow-md'
          : task.isMilestone
            ? 'border-joule-start/20 shadow-sm ring-1 ring-joule-start/30'
            : 'border-border-subtle shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5'
      )}
    >
      {task.isMilestone && (
        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-joule-start/20 to-transparent -mr-4 -mt-4 rotate-45" aria-hidden="true" />
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
          {task.wbs && <span className="text-[10px] font-mono text-text-secondary tracking-tight">WBS: {task.wbs}</span>}
          <h4 className={cn(
            "font-semibold text-base leading-snug break-words",
            task.isMilestone ? "text-text-primary" : "text-text-primary"
          )}>
            {task.title}
          </h4>
        </div>
        <span className={cn(
          "shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ring-1 ring-inset",
          PRIORITY_COLORS[task.priority]
        )}>
          {getPriorityShortLabel(task.priority, t)}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-text-secondary mb-3 line-clamp-2 leading-relaxed">{task.description}</p>
      )}

      {/* Progress Bar */}
      <div className="mb-3 group-hover:opacity-100 transition-opacity">
        <div className="flex justify-between text-xs text-text-secondary mb-1 font-medium">
          <span>{t('kanban.progress')}</span>
          <span className={task.completion === 100 ? 'text-success' : ''}>{task.completion || 0}%</span>
        </div>
        <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              task.completion === 100 ? 'bg-success' : 'bg-primary'
            )}
            style={{ width: `${task.completion || 0}%`}}
            aria-label={`${task.completion || 0}% complete`}
          />
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-border-subtle pt-2.5 mt-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.assignee ? (
            <div className="flex items-center gap-1.5 bg-primary/10 pr-2 py-0.5 rounded-full border border-primary/10">
              <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold">
                {task.assignee.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-primary truncate max-w-[80px] font-medium">
                {task.assignee}
              </span>
            </div>
          ) : (
            <span className="text-xs text-text-secondary italic">{t('task.unassigned')}</span>
          )}
        </div>

        {task.dueDate && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
             task.dueDate < Date.now() && task.status !== TaskStatus.DONE
              ? 'text-negative bg-negative/10 px-1.5 py-0.5 rounded'
              : 'text-text-secondary'
          )}>
            <Calendar className="w-3.5 h-3.5" />
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
    <div className="flex flex-1 gap-4 overflow-x-auto pb-2 h-full snap-x">
      {([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE] as TaskStatus[]).map((status) => (
        <div key={status} className="flex-1 min-w-0 flex flex-col bg-background/50 rounded-2xl border border-border-subtle shadow-inner snap-center">
          <div className="p-4 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
              <span className={cn(
                "w-2.5 h-2.5 rounded-md",
                status === TaskStatus.TODO ? 'bg-text-secondary' :
                status === TaskStatus.IN_PROGRESS ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-success shadow-sm shadow-success/30'
              )} aria-hidden="true" />
              {getStatusLabel(status, t)}
            </h3>
            <span className="bg-surface border border-border-subtle text-text-secondary font-mono text-xs px-2 py-0.5 rounded-full shadow-sm" aria-label={`${groupedTasks[status].length} tasks`}>
              {groupedTasks[status].length}
            </span>
          </div>

          <div className="p-3 pt-0 flex flex-col gap-3 overflow-y-auto flex-1 custom-scrollbar pb-4">
            {groupedTasks[status].length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border-subtle rounded-xl m-1 bg-surface/30">
                 <div className="w-12 h-12 rounded-full bg-surface shadow-sm border border-border-subtle flex items-center justify-center mb-3">
                    <ClipboardList className="w-6 h-6 text-text-secondary/50" />
                 </div>
                 <p className="text-sm font-semibold text-text-secondary">{t('kanban.empty_title')}</p>
                 <p className="text-xs text-text-secondary/70 mt-1">{t('kanban.empty_subtitle')}</p>
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
