import React, { useMemo, useRef, useState, useEffect, useId, memo, useCallback } from 'react';
import { Task, Priority } from '../types';
import { useI18n } from '../src/i18n';

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

type TaskCoord = {
  id: string;
  x: number;
  top: number;
  w: number;
  start: number;
  end: number;
  centerY: number;
  original: TaskEntry;
};

const DAY_MS = 86400000;

const VIEW_SETTINGS: Record<ViewMode, { pxPerDay: number; tickLabelFormat: Intl.DateTimeFormatOptions }> = {
  Day: { pxPerDay: 60, tickLabelFormat: { day: 'numeric', month: 'short' } },
  Week: { pxPerDay: 30, tickLabelFormat: { day: 'numeric', month: 'short' } },
  Month: { pxPerDay: 10, tickLabelFormat: { month: 'long', year: 'numeric' } },
  Year: { pxPerDay: 1.5, tickLabelFormat: { year: 'numeric' } },
};

const getTaskColor = (priority: Priority, isMilestone?: boolean) => {
  if (isMilestone) return '#8b5cf6';
  switch (priority) {
    case Priority.HIGH:
      return '#ef4444';
    case Priority.MEDIUM:
      return '#eab308';
    case Priority.LOW:
      return '#22c55e';
    default:
      return '#6366f1';
  }
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

  const timelineRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingLeftRef = useRef(false);
  const isScrollingRightRef = useRef(false);

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

    // Generate Grid Lines (Ticks)
    const lines: Array<{ time: number; label: string; x: number; isMajor: boolean }> = [];
    const cursor = new Date(sMs);
    
    while (cursor.getTime() <= eMs) {
      const time = cursor.getTime();
      const x = (time - sMs) * pxPerMsValue;
      let label = '';
      let isMajor = false;
      let nextStep: () => void;

      switch (viewMode) {
        case 'Day':
          label = cursor.toLocaleDateString(locale, settings.tickLabelFormat);
          isMajor = cursor.getDay() === 1; // Highlight Mondays
          nextStep = () => cursor.setDate(cursor.getDate() + 1);
          break;
        case 'Week':
           // Label Mondays
          if (cursor.getDay() === 1) {
             label = cursor.toLocaleDateString(locale, settings.tickLabelFormat);
             isMajor = true;
          } else {
             label = ''; // Only label weeks
             isMajor = false;
          }
           // Use daily ticks for grid but only label weeks? Or just weekly ticks?
           // Let's do weekly ticks for the main grid lines
           if (cursor.getDay() !== 1 && lines.length === 0) {
              // Align first tick to next Monday if we started mid-week (though we aligned startMs already)
              // Actually, let's just step by day to draw day-grid if needed, OR step by week.
              // For 'Week' view, usually we want vertical lines every week.
           }
           // Simplification: Loop by day, but only add line if Monday
           // OR Loop by Week. Let's Loop by Week for cleaner grid in Week View.
           if (cursor.getDay() === 1) {
             lines.push({ time, label, x, isMajor: true });
           }
           nextStep = () => cursor.setDate(cursor.getDate() + 1);
           break;
        case 'Month':
          // Major lines at month start
          if (cursor.getDate() === 1) {
             label = cursor.toLocaleDateString(locale, { month: 'short' }); // Jun
             isMajor = true;
             lines.push({ time, label, x, isMajor: true });
          }
          nextStep = () => cursor.setDate(cursor.getDate() + 1);
          break;
        case 'Year':
          // Major lines at Year start, minor at Month start
          if (cursor.getMonth() === 0 && cursor.getDate() === 1) {
             label = cursor.getFullYear().toString();
             isMajor = true;
             lines.push({ time, label, x, isMajor });
          } else if (cursor.getDate() === 1) {
             // Month markers
             label = cursor.toLocaleDateString(locale, { month: 'narrow' });
             isMajor = false;
             lines.push({ time, label, x, isMajor });
          }
          nextStep = () => cursor.setDate(cursor.getDate() + 1);
          break;
        default:
          nextStep = () => cursor.setDate(cursor.getDate() + 1);
      }

      if (viewMode === 'Day') {
        lines.push({ time, label, x, isMajor });
        nextStep();
      } else {
        // Execute the step logic defined in switch
        // For Week/Month/Year we are iterating days to find boundaries
        // Optimization: For Month view, we can jump? No, months length vary.
        // But iterating days for 5 years is ~1800 iterations, totally fine.
        if (lines[lines.length - 1]?.time !== time) {
           // If we didn't push inside switch (e.g. Week view non-Monday), don't push
        }
        nextStep();
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
  const getX = (time: number) => (time - startMs) * pxPerMs;
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

  // Sync scrolling
  useEffect(() => {
    const list = listRef.current;
    const timeline = timelineRef.current;
    if (!list || !timeline) return;
    const syncL = () => {
      if (isScrollingRightRef.current) return;
      isScrollingLeftRef.current = true;
      timeline.scrollTop = list.scrollTop;
      setTimeout(() => isScrollingLeftRef.current = false, 0);
    };
    const syncR = () => {
      if (isScrollingLeftRef.current) return;
      isScrollingRightRef.current = true;
      list.scrollTop = timeline.scrollTop;
      setTimeout(() => isScrollingRightRef.current = false, 0);
    };
    list.addEventListener('scroll', syncL);
    timeline.addEventListener('scroll', syncR);
    return () => {
      list.removeEventListener('scroll', syncL);
      timeline.removeEventListener('scroll', syncR);
    };
  }, []);

  if (tasks.length === 0) return <div className="p-8 text-center text-slate-500">{t('gantt.no_tasks')}</div>;

  // Render Helpers
  const getDisplayValues = (task: TaskEntry) => {
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
    return { start: s, end: e };
  };

  const taskCoords: TaskCoord[] = taskEntries.map((task, i) => {
    const { start, end } = getDisplayValues(task);
    const x = getX(start);
    const w = Math.max(2, getX(end) - x); // Min 2px width
    const top = i * ROW_HEIGHT + BAR_OFFSET_Y;
    const centerY = top + BAR_HEIGHT / 2;
    return { id: task.id, x, top, w, start, end, centerY, original: task };
  });

  const taskMap = new Map<string, TaskCoord>(taskCoords.map((t) => [t.id, t]));
  const taskById = useMemo(() => new Map(taskEntries.map(task => [task.id, task])), [taskEntries]);

  const updateDependencyTooltip = (event: React.MouseEvent<SVGPathElement>, text: string) => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left + timeline.scrollLeft;
    const y = event.clientY - rect.top + timeline.scrollTop;
    setDependencyTooltip({ text, x, y });
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden relative shadow-sm">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer font-medium select-none">
            <input type="checkbox" checked={showList} onChange={() => setShowList(!showList)} className="rounded border-slate-300" />
            {t('gantt.show_list')}
          </label>
        </div>
        <div className="flex gap-1">
          {(['Day', 'Week', 'Month', 'Year'] as ViewMode[]).map(m => (
             <button
               key={m}
               onClick={() => setViewMode(m)}
               className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                 viewMode === m ? 'bg-white text-primary shadow border border-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-700'
               }`}
               aria-label={`${viewModeLabels[m]} view`}
               aria-pressed={viewMode === m}
             >
               {viewModeLabels[m]}
             </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left List */}
        {showList && (
          <div ref={listRef} className="w-64 shrink-0 border-r border-slate-200 bg-white overflow-y-auto overflow-x-hidden z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
             <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 h-10 flex items-center px-4 text-xs font-semibold text-slate-500">
               {t('gantt.task_name')}
             </div>
             {taskEntries.map(task => (
               <div key={task.id} className="h-11 px-4 border-b border-slate-50 flex flex-col justify-center hover:bg-slate-50">
                 <div className="text-sm font-medium text-slate-700 truncate">{task.title}</div>
                 <div className="text-xs text-slate-400 truncate">{task.assignee || t('gantt.unassigned')}</div>
               </div>
             ))}
          </div>
        )}

        {/* Timeline Area */}
        <div ref={timelineRef} className="flex-1 overflow-auto bg-slate-50/30 relative">
          <div style={{ width: Math.max(totalWidth, 100) + 'px', height: '100%', position: 'relative' }}>
            
            {/* Grid Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 h-10 select-none shadow-sm">
               {gridLines.map(line => (
                 <div
                   key={line.time}
                   className={`absolute top-0 bottom-0 border-l border-slate-100 pl-2 pt-2.5 text-xs font-medium text-slate-500 truncate ${line.isMajor ? 'border-slate-300' : ''}`}
                   style={{ left: line.x, width: 200 }} // width just for overflow text
                 >
                   {line.label}
                 </div>
               ))}
            </div>

            {/* Grid Vertical Lines */}
            <div className="absolute inset-0 pointer-events-none">
               {gridLines.map(line => (
                 <div
                   key={line.time}
                   className={`absolute top-0 bottom-0 border-l ${line.isMajor ? 'border-slate-200' : 'border-slate-100'}`}
                   style={{ left: line.x }}
                 />
               ))}
               
               {/* Today Marker */}
               {Date.now() >= startMs && Date.now() <= endMs && (
                 <div 
                   className="absolute top-0 bottom-0 w-px bg-red-400 z-0"
                   style={{ left: getX(Date.now()) }}
                 >
                   <div className="bg-red-400 text-white text-xs px-1 py-0.5 rounded ml-0.5 mt-10 w-fit">{t('gantt.today')}</div>
                 </div>
               )}
            </div>

            {/* Task Layer */}
            <div className="relative pb-10" style={{ height: taskEntries.length * ROW_HEIGHT }}>
               {/* Dependency Lines (SVG) */}
               <svg className="absolute inset-0 w-full h-full overflow-visible">
                 <defs>
                    <marker id={`arrow-head-${arrowId}`} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                    </marker>
                 </defs>
                 {taskEntries.flatMap(task => {
                   if (!task.predecessors?.length) return [];
                   const target = taskMap.get(task.id);
                   if (!target) return [];
                   return task.predecessors.map(predId => {
                     const source = taskMap.get(predId);
                     if (!source) return null;
                     const sourceTask = taskById.get(predId);
                     const targetTask = taskById.get(task.id);
                     const label = sourceTask && targetTask ? `${sourceTask.title} → ${targetTask.title}` : t('gantt.dependency');
                     
                     // Coordinates
                     const x1 = source.x + source.w;
                     const y1 = source.centerY;
                     const x2 = target.x;
                     const y2 = target.centerY;
                     
                     // Path logic: Orthogonal routing
                     const midX = x1 + 20;
                     // Simple S-curve or L-curve
                     const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                     return (
                       <path 
                         key={`${source.id}-${target.id}`}
                         d={d}
                         stroke="#cbd5e1"
                         strokeWidth="1.5"
                         fill="none"
                         markerEnd={`url(#arrow-head-${arrowId})`}
                         className="transition-colors hover:stroke-indigo-400"
                         style={{ pointerEvents: 'stroke' }}
                         onMouseEnter={(event) => updateDependencyTooltip(event, label)}
                         onMouseMove={(event) => updateDependencyTooltip(event, label)}
                         onMouseLeave={() => setDependencyTooltip(null)}
                       />
                     );
                   });
                 })}
               </svg>

               {dependencyTooltip && (
                 <div
                   className="absolute z-20 rounded-md bg-slate-900 text-white text-[10px] px-2 py-1 shadow-md pointer-events-none"
                   style={{ left: dependencyTooltip.x + 8, top: dependencyTooltip.y + 8 }}
                 >
                   {dependencyTooltip.text}
                 </div>
               )}

               {/* Task Bars */}
               {taskCoords.map((t) => {
                 const color = getTaskColor(t.original.priority, t.original.isMilestone);
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
                       backgroundColor: t.original.isMilestone ? 'transparent' : color,
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
                         <div className="w-6 h-6 rotate-45 border-2 bg-white" style={{ borderColor: color }} />
                       </div>
                     ) : (
                       /* Standard Bar */
                       <>
                         <div 
                           className={`w-full h-full rounded shadow-sm opacity-90 hover:opacity-100 flex items-center px-2 cursor-pointer ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                           onMouseDown={(e) => {
                             e.preventDefault();
                             dragDeltaRef.current = 0;
                             setDragDeltaMs(0);
                             setDragState({ id: t.id, mode: 'move', originX: e.clientX, originStart: t.original.startMs, originEnd: t.original.endMs });
                           }}
                           onClick={() => onSelectTask?.(t.id)}
                         >
                            <span className="text-[10px] font-bold text-white truncate drop-shadow-md">{t.original.title}</span>
                         </div>
                         
                         {/* Resize Handles */}
                         <div 
                           className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-white/20 rounded-l"
                           onMouseDown={(e) => {
                             e.stopPropagation();
                             dragDeltaRef.current = 0;
                             setDragDeltaMs(0);
                             setDragState({ id: t.id, mode: 'start', originX: e.clientX, originStart: t.original.startMs, originEnd: t.original.endMs });
                           }}
                         />
                         <div 
                           className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-white/20 rounded-r"
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
