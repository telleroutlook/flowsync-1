import React, { useMemo, memo, useCallback, ChangeEvent } from 'react';
import { Task, TaskStatus, Priority } from '../types';
import { getTaskStart, getTaskEnd } from '../src/utils';
import { useI18n } from '../src/i18n';
import { getPriorityLabel, getStatusLabel } from '../src/i18n/labels';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '../src/utils/cn';
import { X, AlertTriangle, Check, Trash2, Calendar } from 'lucide-react';

const DAY_MS = 86400000;
const clampCompletion = (value: number) => Math.min(100, Math.max(0, value));

interface TaskDetailPanelProps {
  selectedTask: Task;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  tasks: Task[];
}

const formatDateInput = (value?: number) => {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayNum = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
};

const parseDateInput = (value: string) => {
  if (!value) return undefined;
  const [year, month, dayNum] = value.split('-').map(Number);
  if (!year || !month || !dayNum) return undefined;
  return new Date(year, month - 1, dayNum).getTime();
};

export const TaskDetailPanel = memo<TaskDetailPanelProps>(({
  selectedTask,
  onClose,
  onUpdate,
  tasks
}) => {
  const { t } = useI18n();

  const predecessorDetails = useMemo(() => {
    if (!selectedTask) return [];
    const refs = selectedTask.predecessors || [];
    return refs.map(ref => {
      const match = tasks.find(task => task.id === ref || task.wbs === ref);
      if (!match) {
        return { ref, task: null, conflict: false };
      }
      const conflict = getTaskEnd(match) > getTaskStart(selectedTask);
      return { ref, task: match, conflict };
    });
  }, [selectedTask, tasks]);

  const hasPredecessorConflicts = predecessorDetails.some(item => item.conflict);

  const availableTasks = useMemo(() => {
    return tasks.filter(task =>
      task.id !== selectedTask.id &&
      !selectedTask.predecessors?.includes(task.id) &&
      (!task.wbs || !selectedTask.predecessors?.includes(task.wbs))
    );
  }, [tasks, selectedTask]);

  const handleUpdate = useCallback((field: keyof Task, value: unknown) => {
    onUpdate(selectedTask.id, { [field]: value });
  }, [onUpdate, selectedTask.id]);

  const handleRemovePredecessor = useCallback((ref: string) => {
    const predecessors = (selectedTask.predecessors || []).filter(p => p !== ref);
    onUpdate(selectedTask.id, { predecessors });
  }, [onUpdate, selectedTask]);

  const handleAddPredecessor = useCallback((taskId: string) => {
    const predecessors = [...(selectedTask.predecessors || []), taskId];
    onUpdate(selectedTask.id, { predecessors });
  }, [onUpdate, selectedTask]);

  const handleFixSchedule = useCallback(() => {
    const maxEnd = predecessorDetails.reduce((acc, item) => {
      if (!item.task) return acc;
      return Math.max(acc, getTaskEnd(item.task));
    }, getTaskStart(selectedTask));
    const currentStart = getTaskStart(selectedTask);
    const currentEnd = getTaskEnd(selectedTask);
    const duration = Math.max(DAY_MS, currentEnd - currentStart);
    const nextStart = maxEnd;
    const nextEnd = Math.max(nextStart + DAY_MS, nextStart + duration);
    onUpdate(selectedTask.id, { startDate: nextStart, dueDate: nextEnd });
  }, [onUpdate, selectedTask, predecessorDetails]);

  return (
    <div className="w-[350px] bg-surface border-l border-border-subtle shadow-xl flex flex-col h-full animate-slide-in-right z-30">
      <div className="p-3 border-b border-border-subtle flex items-center justify-between bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{t('task.details')}</span>
          {selectedTask.isMilestone && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-bold border border-accent/20">{t('task.milestone')}</span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider" htmlFor="task-title">{t('task.title')}</label>
          <Input
            id="task-title"
            className="font-semibold text-sm h-9 px-3"
            value={selectedTask.title}
            onChange={(event) => handleUpdate('title', event.target.value)}
          />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider" htmlFor="task-status">{t('task.status')}</label>
            <select
              id="task-status"
              className="flex h-8 w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              value={selectedTask.status}
              onChange={(event) => handleUpdate('status', event.target.value as TaskStatus)}
            >
              <option value={TaskStatus.TODO}>{getStatusLabel(TaskStatus.TODO, t)}</option>
              <option value={TaskStatus.IN_PROGRESS}>{getStatusLabel(TaskStatus.IN_PROGRESS, t)}</option>
              <option value={TaskStatus.DONE}>{getStatusLabel(TaskStatus.DONE, t)}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider" htmlFor="task-priority">{t('task.priority')}</label>
            <select
              id="task-priority"
              className="flex h-8 w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              value={selectedTask.priority}
              onChange={(event) => handleUpdate('priority', event.target.value as Priority)}
            >
              <option value={Priority.LOW}>{getPriorityLabel(Priority.LOW, t)}</option>
              <option value={Priority.MEDIUM}>{getPriorityLabel(Priority.MEDIUM, t)}</option>
              <option value={Priority.HIGH}>{getPriorityLabel(Priority.HIGH, t)}</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="p-3 bg-background rounded-lg border border-border-subtle space-y-3">
          <div className="flex items-center gap-2 text-text-primary font-semibold text-[11px] border-b border-border-subtle pb-1.5 mb-1">
             <Calendar className="w-3.5 h-3.5 text-primary" />
             {t('task.schedule')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-text-secondary" htmlFor="task-start">{t('task.start_date')}</label>
              <Input
                id="task-start"
                type="date"
                className="bg-surface h-7 text-xs px-2"
                value={formatDateInput(selectedTask.startDate ?? selectedTask.createdAt)}
                onChange={(event) => {
                  const startDate = parseDateInput(event.target.value);
                  if (startDate) handleUpdate('startDate', startDate);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-text-secondary" htmlFor="task-due">{t('task.due_date')}</label>
              <Input
                id="task-due"
                type="date"
                className={cn("bg-surface h-7 text-xs px-2", selectedTask.dueDate && selectedTask.dueDate < Date.now() && selectedTask.status !== TaskStatus.DONE && "border-negative text-negative")}
                value={formatDateInput(selectedTask.dueDate)}
                onChange={(event) => {
                  const dueDate = parseDateInput(event.target.value);
                  if (dueDate) handleUpdate('dueDate', dueDate);
                }}
              />
            </div>
          </div>
        </div>

        {/* Assignee & WBS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider" htmlFor="task-assignee">{t('task.assignee')}</label>
            <Input
              id="task-assignee"
              placeholder={t('task.unassigned')}
              className="h-8 text-xs px-2"
              value={selectedTask.assignee || ''}
              onChange={(event) => handleUpdate('assignee', event.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider" htmlFor="task-wbs">{t('task.wbs_code')}</label>
            <Input
              id="task-wbs"
              className="font-mono text-[10px] h-8 px-2"
              placeholder="1.0"
              value={selectedTask.wbs || ''}
              onChange={(event) => handleUpdate('wbs', event.target.value || undefined)}
            />
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider" htmlFor="task-completion">{t('task.completion')}</label>
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{selectedTask.completion ?? 0}%</span>
          </div>
          <input
            id="task-completion"
            type="range"
            min={0}
            max={100}
            value={selectedTask.completion ?? 0}
            onChange={(event) => handleUpdate('completion', clampCompletion(Number(event.target.value)))}
            className="w-full h-1.5 bg-secondary/20 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Dependencies */}
        <div className="space-y-2.5 pt-3 border-t border-border-subtle">
          <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            {t('task.dependencies')}
            <span className="bg-secondary/10 text-secondary text-[10px] px-1.5 py-0.5 rounded-full">{predecessorDetails.length}</span>
          </label>

          <div className="space-y-1.5">
            {predecessorDetails.map((item) => (
              <div key={item.ref} className="flex items-center justify-between bg-background border border-border-subtle rounded-md p-2 group">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-medium text-text-primary truncate">
                    {item.task ? item.task.title : item.ref}
                  </span>
                  {item.task && (
                    <span className="text-[9px] text-text-secondary font-mono">
                      {item.task.wbs ? `WBS: ${item.task.wbs}` : `ID: ${item.task.id.slice(0, 8)}`}
                    </span>
                  )}
                  {!item.task && (
                    <span className="text-[9px] text-negative italic">{t('task.not_found')}</span>
                  )}
                </div>
                <button
                  onClick={() => handleRemovePredecessor(item.ref)}
                  className="p-1 text-text-secondary hover:text-negative hover:bg-negative/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove dependency"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <select
              className="flex h-8 w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              value=""
              onChange={(event) => {
                const taskId = event.target.value;
                if (taskId) handleAddPredecessor(taskId);
              }}
            >
              <option value="">{t('task.add_dependency')}</option>
              {availableTasks.map(task => (
                <option key={task.id} value={task.id}>
                   {task.wbs ? `[${task.wbs}] ` : ''}{task.title}
                </option>
              ))}
            </select>
          </div>

          {hasPredecessorConflicts && (
            <div className="bg-negative/5 border border-negative/20 rounded-md p-2 animate-fade-in" role="alert">
              <div className="flex items-start gap-1.5 text-negative mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold">{t('task.schedule_conflict')}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFixSchedule}
                className="w-full h-7 text-xs"
              >
                {t('task.fix_schedule')}
              </Button>
            </div>
          )}
        </div>

        <div className="pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer group p-1.5 hover:bg-background rounded-md border border-transparent hover:border-border-subtle transition-all">
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                selectedTask.isMilestone ? "bg-accent border-accent text-accent-foreground" : "bg-surface border-border-subtle group-hover:border-accent"
              )}>
                {selectedTask.isMilestone && <Check className="w-3 h-3" />}
              </div>
              <input
              type="checkbox"
              className="hidden"
              checked={!!selectedTask.isMilestone}
              onChange={(event) => handleUpdate('isMilestone', event.target.checked)}
            />
            <span className="text-xs text-text-primary font-medium">{t('task.mark_milestone')}</span>
          </label>
        </div>

      </div>
    </div>
  );
});
TaskDetailPanel.displayName = 'TaskDetailPanel';
