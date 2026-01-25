import React, { useMemo } from 'react';
import { Task, TaskStatus, Priority } from '../types';
import { getTaskStart, getTaskEnd } from '../src/utils';
import { useI18n } from '../src/i18n';
import { getPriorityLabel, getStatusLabel } from '../src/i18n/labels';

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

export const TaskDetailPanel = React.memo<TaskDetailPanelProps>(({
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

  return (
    <div className="w-[300px] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col h-full animate-slide-in-right">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('task.details')}</span>
          {selectedTask.isMilestone && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-200">{t('task.milestone')}</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('task.title')}</label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            value={selectedTask.title}
            onChange={(event) => {
              const title = event.target.value;
              onUpdate(selectedTask.id, { title });
            }}
          />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('task.status')}</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-indigo-500 outline-none"
              value={selectedTask.status}
              onChange={(event) => {
                const status = event.target.value as TaskStatus;
                onUpdate(selectedTask.id, { status });
              }}
            >
              <option value={TaskStatus.TODO}>{getStatusLabel(TaskStatus.TODO, t)}</option>
              <option value={TaskStatus.IN_PROGRESS}>{getStatusLabel(TaskStatus.IN_PROGRESS, t)}</option>
              <option value={TaskStatus.DONE}>{getStatusLabel(TaskStatus.DONE, t)}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('task.priority')}</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-indigo-500 outline-none"
              value={selectedTask.priority}
              onChange={(event) => {
                const priority = event.target.value as Priority;
                onUpdate(selectedTask.id, { priority });
              }}
            >
              <option value={Priority.LOW}>{getPriorityLabel(Priority.LOW, t)}</option>
              <option value={Priority.MEDIUM}>{getPriorityLabel(Priority.MEDIUM, t)}</option>
              <option value={Priority.HIGH}>{getPriorityLabel(Priority.HIGH, t)}</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase">{t('task.start_date')}</label>
              <input
                type="date"
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 outline-none"
                value={formatDateInput(selectedTask.startDate ?? selectedTask.createdAt)}
                onChange={(event) => {
                  const startDate = parseDateInput(event.target.value);
                  if (!startDate) return;
                  onUpdate(selectedTask.id, { startDate });
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase">{t('task.due_date')}</label>
              <input
                type="date"
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 outline-none"
                value={formatDateInput(selectedTask.dueDate)}
                onChange={(event) => {
                  const dueDate = parseDateInput(event.target.value);
                  if (!dueDate) return;
                  onUpdate(selectedTask.id, { dueDate });
                }}
              />
            </div>
          </div>
        </div>

        {/* Assignee & WBS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('task.assignee')}</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 outline-none"
              placeholder={t('task.unassigned')}
              value={selectedTask.assignee || ''}
              onChange={(event) => {
                const assignee = event.target.value;
                onUpdate(selectedTask.id, { assignee });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('task.wbs_code')}</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 font-mono focus:border-indigo-500 outline-none"
              placeholder="1.0"
              value={selectedTask.wbs || ''}
              onChange={(event) => {
                const wbs = event.target.value;
                onUpdate(selectedTask.id, { wbs });
              }}
            />
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('task.completion')}</label>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selectedTask.completion ?? 0}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={selectedTask.completion ?? 0}
            onChange={(event) => {
              const completion = clampCompletion(Number(event.target.value));
              onUpdate(selectedTask.id, { completion });
            }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Dependencies */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            {t('task.dependencies')}
            <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">{predecessorDetails.length}</span>
          </label>
          
          <div className="space-y-2">
            {predecessorDetails.map((item) => (
              <div key={item.ref} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-semibold text-slate-700 truncate">
                    {item.task ? item.task.title : item.ref}
                  </span>
                  {item.task && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.task.wbs ? `WBS: ${item.task.wbs}` : `ID: ${item.task.id.slice(0, 8)}`}
                    </span>
                  )}
                  {!item.task && (
                    <span className="text-[10px] text-rose-400 italic">{t('task.not_found')}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    const predecessors = (selectedTask.predecessors || []).filter(p => p !== item.ref);
                    onUpdate(selectedTask.id, { predecessors });
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                  title="Remove dependency"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 outline-none"
              value=""
              onChange={(event) => {
                const taskId = event.target.value;
                if (!taskId) return;
                const predecessors = [...(selectedTask.predecessors || []), taskId];
                onUpdate(selectedTask.id, { predecessors });
              }}
            >
              <option value="" disabled>{t('task.add_dependency')}</option>
              {availableTasks.map(task => (
                <option key={task.id} value={task.id}>
                   {task.wbs ? `[${task.wbs}] ` : ''}{task.title}
                </option>
              ))}
            </select>
          </div>
          
          {hasPredecessorConflicts && (
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 animate-fade-in">
              <div className="flex items-start gap-2 text-rose-700 mb-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span className="text-xs font-semibold">{t('task.schedule_conflict')}</span>
              </div>
              <button
                type="button"
                onClick={() => {
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
                }}
                className="w-full rounded-md bg-white border border-rose-200 py-1.5 text-xs font-bold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors"
              >
                {t('task.fix_schedule')}
              </button>
            </div>
          )}
        </div>
        
        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedTask.isMilestone ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300 group-hover:border-amber-400'}`}>
                {selectedTask.isMilestone && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <input
              type="checkbox"
              className="hidden"
              checked={!!selectedTask.isMilestone}
              onChange={(event) => {
                const isMilestone = event.target.checked;
                onUpdate(selectedTask.id, { isMilestone });
              }}
            />
            <span className="text-sm text-slate-700 font-medium">{t('task.mark_milestone')}</span>
          </label>
        </div>

      </div>
    </div>
  );
});
