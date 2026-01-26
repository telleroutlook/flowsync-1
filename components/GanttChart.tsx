import React, { useMemo, useRef, useState, useEffect, useId, memo, useCallback } from 'react';
import { Task, Priority } from '../types';
import { useI18n } from '../src/i18n';
import { cn } from '../src/utils/cn';

interface GanttChartProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (id: string) => void;
  onUpdateTaskDates?: (id: string, startDate: number, dueDate: number) => void;
}

type ViewMode = 'Day' | 'Week' | 'Month' | 'Year';

type DragMode = 'move' | 'start' | 'end';

type DragState = {
  id: string;
  mode: DragMode;
  originX: number;
  originStart: number;
  originEnd: number;
};

type TaskEntry = Task & { startMs: number; endMs: number };

const DAY_MS = 86400000;

// Move outside component to avoid recreation
const VIEW_SETTINGS: Record<ViewMode, { pxPerDay: number; tickLabelFormat: Intl.DateTimeFormatOptions }> = {
  Day: { pxPerDay: 60, tickLabelFormat: { day: 'numeric', month: 'short' } },
  Week: { pxPerDay: 30, tickLabelFormat: { day: 'numeric', month: 'short' } },
  Month: { pxPerDay: 10, tickLabelFormat: { month: 'long', year: 'numeric' } },
  Year: { pxPerDay: 1.5, tickLabelFormat: { year: 'numeric' } },
} as const;

// Move outside component and use record lookup for better performance
const TASK_COLOR_CLASSES: Record<Priority, string> = {
  [Priority.LOW]: 'bg-success',
  [Priority.MEDIUM]: 'bg-warning',
  [Priority.HIGH]: 'bg-negative',
};

const getTaskColorClass = (priority: Priority, isMilestone?: boolean): string => {
  if (isMilestone) return 'border-accent';
  return TASK_COLOR_CLASSES[priority] || 'bg-primary';
};

const ROW_HEIGHT = 44;
const BAR_HEIGHT = 32;
const BAR_OFFSET_Y = (ROW_HEIGHT - BAR_HEIGHT) / 2;

export const GanttChart: React.FC<GanttChartProps> = memo(({
  tasks,
  selectedTaskId,
  onSelectTask,
  onUpdateTaskDates,
}) => {
  const { t, locale } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('Month');
  const [showList, setShowList] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDeltaMs, setDragDeltaMs] = useState(0);
  const dragDeltaRef = useRef(0);
  const [dependencyTooltip, setDependencyTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const arrowId = useId();

  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const viewModeLabels: Record<ViewMode, string> = useMemo(() => ({
    Day: t('gantt.view.day'),
    Week: t('gantt.view.week'),
    Month: t('gantt.view.month'),
    Year: t('gantt.view.year'),
  }), [t]);

  // 1. Prepare Task Data
  const taskEntries = useMemo<TaskEntry[]>(() => {
    if (tasks.length === 0) return [];
    return tasks
      .map(task => {
        const start = task.startDate ?? task.createdAt;
        const end = task.dueDate ?? start + DAY_MS;
        const safeEnd = end <= start ? start + DAY_MS : end;
        return { ...task, startMs: start, endMs: safeEnd };
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [tasks]);

  // 2. Compute Timeline Bounds & Scale
  const { startMs, endMs, totalWidth, pxPerMs, gridLines } = useMemo(() => {
    if (taskEntries.length === 0) {
      return { startMs: 0, endMs: 0, totalWidth: 0, pxPerMs: 0, gridLines: [] };
    }

    // Add padding to timeline
    const rawStart = Math.min(...taskEntries.map(t => t.startMs));
    const rawEnd = Math.max(...taskEntries.map(t => t.endMs));
    
    // Adjust start/end to nice boundaries based on ViewMode
    const startDate = new Date(rawStart);
    startDate.setDate(startDate.getDate() - 7); // Buffer before
    const endDate = new Date(rawEnd);
    endDate.setDate(endDate.getDate() + 14); // Buffer after

    // Align to start of year/month/week for clean grid
    if (viewMode === 'Year') {
      startDate.setMonth(0, 1);
      endDate.setMonth(11, 31);
    } else if (viewMode === 'Month') {
      startDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + 1, 0);
    } else if (viewMode === 'Week') {
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - ((day + 6) % 7));
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const sMs = startDate.getTime();
    const eMs = endDate.getTime();
    
    const settings = VIEW_SETTINGS[viewMode];
    const pxPerMsValue = settings.pxPerDay / DAY_MS;
    const totalW = (eMs - sMs) * pxPerMsValue;

    // Generate Grid Lines (Ticks) - optimized to reduce iterations
    const lines: Array<{ time: number; label: string; x: number; isMajor: boolean }> = [];
    const cursor = new Date(sMs);

    // Use different iteration strategies based on view mode for efficiency
    if (viewMode === 'Day') {
      while (cursor.getTime() <= eMs) {
        const time = cursor.getTime();
        const x = (time - sMs) * pxPerMsValue;
        lines.push({
          time,
          label: cursor.toLocaleDateString(locale, settings.tickLabelFormat),
          x,
          isMajor: cursor.getDay() === 1
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (viewMode === 'Week') {
      // Only iterate Mondays for week view
      cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
      while (cursor.getTime() <= eMs) {
        const time = cursor.getTime();
        const x = (time - sMs) * pxPerMsValue;
        lines.push({
          time,
          label: cursor.toLocaleDateString(locale, settings.tickLabelFormat),
          x,
          isMajor: true
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    } else if (viewMode === 'Month') {
      // Only iterate month starts
      cursor.setDate(1);
      while (cursor.getTime() <= eMs) {
        const time = cursor.getTime();
        const x = (time - sMs) * pxPerMsValue;
        lines.push({
          time,
          label: cursor.toLocaleDateString(locale, { month: 'short' }),
          x,
          isMajor: true
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else if (viewMode === 'Year') {
      // Iterate months for year view
      cursor.setDate(1);
      while (cursor.getTime() <= eMs) {
        const time = cursor.getTime();
        const x = (time - sMs) * pxPerMsValue;
        const isYearStart = cursor.getMonth() === 0;
        lines.push({
          time,
          label: isYearStart
            ? cursor.getFullYear().toString()
            : cursor.toLocaleDateString(locale, { month: 'narrow' }),
          x,
          isMajor: isYearStart
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    return {
      startMs: sMs,
      endMs: eMs,
      totalWidth: totalW,
      pxPerMs: pxPerMsValue,
      gridLines: lines
    };
  }, [taskEntries, viewMode, locale]);

  // Helper: Time -> X
  const getX = useCallback((time: number) => (time - startMs) * pxPerMs, [startMs, pxPerMs]);

  // 3. Drag Logic
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (event: MouseEvent) => {
      if (!pxPerMs) return;
      const deltaPx = event.clientX - dragState.originX;
      // Convert pixel delta to time delta
      const deltaMsRaw = deltaPx / pxPerMs;
      // Snap to Days (always snap to at least 1 day for UX sanity)
      const snappedDeltaMs = Math.round(deltaMsRaw / DAY_MS) * DAY_MS;
      if (snappedDeltaMs !== dragDeltaRef.current) {
        dragDeltaRef.current = snappedDeltaMs;
        setDragDeltaMs(snappedDeltaMs);
      }
    };

    const handleUp = () => {
      const appliedDelta = dragDeltaRef.current;
      if (appliedDelta === 0) {
        setDragState(null);
        return;
      }

      let nextStart = dragState.originStart;
      let nextEnd = dragState.originEnd;

      if (dragState.mode === 'move') {
        nextStart += appliedDelta;
        nextEnd += appliedDelta;
      } else if (dragState.mode === 'start') {
        nextStart = Math.min(dragState.originEnd - DAY_MS, dragState.originStart + appliedDelta);
      } else if (dragState.mode === 'end') {
        nextEnd = Math.max(dragState.originStart + DAY_MS, dragState.originEnd + appliedDelta);
      }

      onUpdateTaskDates?.(dragState.id, nextStart, nextEnd);
      setDragState(null);
      setDragDeltaMs(0);
      dragDeltaRef.current = 0;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, pxPerMs, onUpdateTaskDates]);

  // Sync scroll
  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  if (tasks.length === 0) return <div className="p-8 text-center text-text-secondary">{t('gantt.no_tasks')}</div>;

  // Compute task coordinates with drag state applied - memoized for performance
  const taskCoords = useMemo(() => {
    return taskEntries.map((task, i) => {
      let s = task.startMs;
      let e = task.endMs;

      if (dragState?.id === task.id) {
        if (dragState.mode === 'move') {
          s += dragDeltaMs;
          e += dragDeltaMs;
        } else if (dragState.mode === 'start') {
          s = Math.min(task.endMs - DAY_MS, s + dragDeltaMs);
        } else if (dragState.mode === 'end') {
          e = Math.max(task.startMs + DAY_MS, e + dragDeltaMs);
        }
      }

      const x = getX(s);
      const w = Math.max(2, getX(e) - x);
      const top = i * ROW_HEIGHT + BAR_OFFSET_Y;
      const centerY = top + BAR_HEIGHT / 2;
      return { id: task.id, x, top, w, start: s, end: e, centerY, original: task };
    });
  }, [taskEntries, dragState, dragDeltaMs, getX]);

  const taskMap = useMemo(() => new Map(taskCoords.map((t) => [t.id, t])), [taskCoords]);
  const taskById = useMemo(() => new Map(taskEntries.map(task => [task.id, task])), [taskEntries]);

  // Pre-compute dependency links to avoid flatMap on every render
  const dependencyLinks = useMemo(() => {
    const links: Array<{
      key: string;
      d: string;
      label: string;
    }> = [];

    taskEntries.forEach(task => {
      if (!task.predecessors?.length) return;
      const target = taskMap.get(task.id);
      if (!target) return;

      task.predecessors.forEach(predId => {
        const source = taskMap.get(predId);
        if (!source) return;
        const sourceTask = taskById.get(predId);
        const targetTask = taskById.get(task.id);
        const label = sourceTask && targetTask ? `${sourceTask.title} → ${targetTask.title}` : t('gantt.dependency');

        const x1 = source.x + source.w;
        const y1 = source.centerY;
        const x2 = target.x;
        const y2 = target.centerY;
        const midX = x1 + 20;
        const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

        links.push({ key: `${source.id}-${target.id}`, d, label });
      });
    });

    return links;
  }, [taskEntries, taskMap, taskById, t]);

  const updateDependencyTooltip = useCallback((event: React.MouseEvent<SVGPathElement>, text: string) => {
    const body = bodyRef.current;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const x = event.clientX - rect.left + body.scrollLeft;
    const y = event.clientY - rect.top + body.scrollTop;
    setDependencyTooltip({ text, x, y });
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface border border-border-subtle rounded-xl overflow-hidden relative shadow-sm">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border-subtle shrink-0 z-20">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer font-medium select-none">
            <input type="checkbox" checked={showList} onChange={() => setShowList(!showList)} className="rounded border-border-subtle text-primary focus:ring-primary" />
            {t('gantt.show_list')}
          </label>
        </div>
        <div className="flex gap-1">
          {(['Day', 'Week', 'Month', 'Year'] as ViewMode[]).map(m => (
             <button
               key={m}
               onClick={() => setViewMode(m)}
               className={cn(
                 "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                 viewMode === m 
                   ? "bg-surface text-primary shadow border border-border-subtle" 
                   : "text-text-secondary hover:bg-surface hover:text-text-primary"
               )}
               aria-label={`${viewModeLabels[m]} view`}
               aria-pressed={viewMode === m}
             >
               {viewModeLabels[m]}
             </button>
          ))}
        </div>
      </div>

      {/* Header Row (Fixed) */}
      <div className="flex h-10 border-b border-border-subtle bg-surface shrink-0 z-10">
        {/* Top Left: Task Name */}
        {showList && (
          <div className="w-64 shrink-0 border-r border-border-subtle px-4 flex items-center text-xs font-semibold text-text-secondary bg-background shadow-sm z-20">
             {t('gantt.task_name')}
          </div>
        )}
        
        {/* Timeline Header (Scrollable, Synced) */}
        <div ref={headerRef} className="flex-1 overflow-hidden relative bg-surface">
           <div style={{ width: Math.max(totalWidth, 100) + 'px', height: '100%' }} className="relative">
              {gridLines.map(line => (
                <div
                  key={line.time}
                  className={cn(
                    "absolute top-0 bottom-0 border-l border-border-subtle/50 pl-2 pt-2.5 text-xs font-medium text-text-secondary truncate",
                    line.isMajor && "border-border-subtle"
                  )}
                  style={{ left: line.x, width: 200 }}
                >
                  {line.label}
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Body (Scrollable) */}
      <div 
        ref={bodyRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleBodyScroll}
      >
        <div className="flex min-w-full w-max">
            {/* Sticky List Column */}
            {showList && (
               <div className="sticky left-0 w-64 shrink-0 z-30 bg-surface border-r border-border-subtle shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                 {taskEntries.map(task => (
                   <div 
                     key={task.id} 
                     className="px-4 border-b border-border-subtle/50 flex flex-col justify-center hover:bg-background cursor-pointer transition-colors hover:text-primary box-border"
                     style={{ height: ROW_HEIGHT }}
                     onClick={() => onSelectTask?.(task.id)}
                   >
                     <div className="text-sm font-medium text-text-primary truncate">{task.title}</div>
                     <div className="text-xs text-text-secondary truncate">{task.assignee || t('gantt.unassigned')}</div>
                   </div>
                 ))}
               </div>
            )}

            {/* Timeline Content */}
            <div className="relative flex-1" style={{ width: Math.max(totalWidth, 100) + 'px', height: taskEntries.length * ROW_HEIGHT }}>
               {/* Grid Vertical Lines */}
               <div className="absolute inset-0 pointer-events-none z-0">
                   {gridLines.map(line => (
                     <div
                       key={line.time}
                       className={cn(
                         "absolute top-0 bottom-0 border-l",
                         line.isMajor ? "border-border-subtle" : "border-border-subtle/50"
                       )}
                       style={{ left: line.x }}
                     />
                   ))}
                   
                   {/* Today Marker */}
                   {Date.now() >= startMs && Date.now() <= endMs && (
                     <div 
                       className="absolute top-0 bottom-0 w-px bg-critical z-0"
                       style={{ left: getX(Date.now()) }}
                     >
                       {/* Label moved to header if we wanted, but sticking it here is fine too */}
                     </div>
                   )}
               </div>

               {/* Task & Dependency Layer */}
               <div className="relative z-10 w-full h-full">
                   {/* Dependency Lines (SVG) */}
                   <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                     <defs>
                        <marker id={`arrow-head-${arrowId}`} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                          <path d="M0,0 L6,3 L0,6 Z" className="fill-secondary" />
                        </marker>
                     </defs>
                     {dependencyLinks.map(link => (
                       <path
                         key={link.key}
                         d={link.d}
                         strokeWidth="1.5"
                         fill="none"
                         markerEnd={`url(#arrow-head-${arrowId})`}
                         className="stroke-secondary transition-colors hover:stroke-primary pointer-events-auto"
                         onMouseEnter={(event) => updateDependencyTooltip(event, link.label)}
                         onMouseMove={(event) => updateDependencyTooltip(event, link.label)}
                         onMouseLeave={() => setDependencyTooltip(null)}
                       />
                     ))}
                   </svg>

                   {/* Dependency Tooltip */}
                   {dependencyTooltip && (
                     <div
                       className="absolute z-20 rounded-md bg-text-primary text-surface text-[10px] px-2 py-1 shadow-md pointer-events-none"
                       style={{ left: dependencyTooltip.x + 8, top: dependencyTooltip.y + 8 }}
                     >
                       {dependencyTooltip.text}
                     </div>
                   )}

                   {/* Task Bars */}
                   {taskCoords.map((t) => {
                     const colorClass = getTaskColorClass(t.original.priority, t.original.isMilestone);
                     const isSelected = selectedTaskId === t.id;
                     const isDragging = dragState?.id === t.id;

                     return (
                       <div
                         key={t.id}
                         className="absolute h-8 rounded-md select-none group"
                         style={{
                           left: t.x,
                           top: t.top,
                           width: t.w,
                           opacity: isDragging ? 0.9 : 1
                         }}
                       > 
                         {/* Milestone Diamond */}
                         {t.original.isMilestone ? (
                           <div
                             className="relative w-8 h-8 flex items-center justify-center cursor-pointer"
                             onMouseDown={(e) => {
                               e.preventDefault();
                               dragDeltaRef.current = 0;
                               setDragDeltaMs(0);
                               setDragState({ id: t.id, mode: 'move', originX: e.clientX, originStart: t.original.startMs, originEnd: t.original.endMs });
                             }}
                             onClick={() => onSelectTask?.(t.id)}
                           >
                             <div className={cn("w-6 h-6 rotate-45 border-2 bg-surface", colorClass)} />
                           </div>
                         ) : (
                           /* Standard Bar */
                           <>
                             <div 
                               className={cn(
                                 "w-full h-full rounded shadow-sm opacity-90 hover:opacity-100 flex items-center px-2 cursor-pointer transition-all",
                                 colorClass,
                                 isSelected && "ring-2 ring-primary ring-offset-1"
                               )}
                               onMouseDown={(e) => {
                                 e.preventDefault();
                                 dragDeltaRef.current = 0;
                                 setDragDeltaMs(0);
                                 setDragState({ id: t.id, mode: 'move', originX: e.clientX, originStart: t.original.startMs, originEnd: t.original.endMs });
                               }}
                               onClick={() => onSelectTask?.(t.id)}
                             >
                                <span className="text-[10px] font-bold text-primary-foreground truncate drop-shadow-md">{t.original.title}</span>
                             </div>
                             
                             {/* Resize Handles */}
                             <div 
                               className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-surface/20 rounded-l"
                               onMouseDown={(e) => {
                                 e.stopPropagation();
                                 dragDeltaRef.current = 0;
                                 setDragDeltaMs(0);
                                 setDragState({ id: t.id, mode: 'start', originX: e.clientX, originStart: t.original.startMs, originEnd: t.original.endMs });
                               }}
                             />
                             <div 
                               className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-surface/20 rounded-r"
                               onMouseDown={(e) => {
                                 e.stopPropagation();
                                 dragDeltaRef.current = 0;
                                 setDragDeltaMs(0);
                                 setDragState({ id: t.id, mode: 'end', originX: e.clientX, originStart: t.original.startMs, originEnd: t.original.endMs });
                               }}
                             />
                           </>
                         )}
                       </div>
                     );
                   })}
               </div>
            </div>
        </div>
      </div>
    </div>
  );
});
GanttChart.displayName = 'GanttChart';