import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Task, Priority } from '../types';

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

const DAY_MS = 86400000;

const viewSteps: Record<ViewMode, number> = {
  Day: 1,
  Week: 1,
  Month: 7,
  Year: 30,
};

const minColumnWidths: Record<ViewMode, number> = {
  Day: 70,
  Week: 70,
  Month: 110,
  Year: 140,
};

const formatTick = (date: Date, viewMode: ViewMode) => {
  switch (viewMode) {
    case 'Day':
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    case 'Week':
      return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    case 'Month':
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    case 'Year':
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    default:
      return date.toLocaleDateString();
  }
};

const shouldLabelTick = (date: Date, viewMode: ViewMode, index: number) => {
  if (viewMode === 'Day') return true;
  if (viewMode === 'Week') return true;
  if (viewMode === 'Month') return date.getDate() <= 7 || index === 0;
  if (viewMode === 'Year') return date.getMonth() % 2 === 0 || index === 0;
  return true;
};

const SNAP_THRESHOLD_MS = DAY_MS * 2;

const snapToMonday = (dateMs: number) => {
  const date = new Date(dateMs);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const snapToMonthEnd = (dateMs: number) => {
  const date = new Date(dateMs);
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth.getTime();
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

const getDurationDays = (start: number, end: number) =>
  Math.max(1, Math.ceil((end - start) / DAY_MS));

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onUpdateTaskDates,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('Month');
  const [showList, setShowList] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDeltaMs, setDragDeltaMs] = useState(0);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredDependency, setHoveredDependency] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingLeftRef = useRef(false);
  const isScrollingRightRef = useRef(false);

  const taskEntries = useMemo(() => {
    if (tasks.length === 0) return [];

    return tasks
      .map(task => {
        const start = task.startDate ?? task.createdAt;
        const end = task.dueDate ?? start + DAY_MS;
        const safeEnd = end <= start ? start + DAY_MS : end;
        return {
          ...task,
          startMs: start,
          endMs: safeEnd,
        };
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [tasks]);

  const timeline = useMemo(() => {
    if (taskEntries.length === 0) return null;
    const startMs = Math.min(...taskEntries.map(task => task.startMs));
    const endMs = Math.max(...taskEntries.map(task => task.endMs));
    const totalDays = Math.max(1, Math.ceil((endMs - startMs) / DAY_MS) + 1);
    const step = viewSteps[viewMode];
    const ticks: number[] = [];
    for (let day = 0; day <= totalDays; day += step) {
      ticks.push(startMs + day * DAY_MS);
    }
    if (ticks[ticks.length - 1] < endMs) ticks.push(endMs);
    const monthSegments: Array<{ label: string; start: number; end: number }> = [];
    const cursor = new Date(startMs);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endMs) {
      const monthStart = new Date(cursor.getTime());
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      monthEnd.setHours(0, 0, 0, 0);
      monthSegments.push({
        label: monthStart.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        start: monthStart.getTime(),
        end: monthEnd.getTime(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return {
      startMs,
      endMs,
      totalMs: Math.max(DAY_MS, endMs - startMs),
      ticks,
      totalDays,
      monthSegments,
    };
  }, [taskEntries, viewMode]);

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (event: MouseEvent) => {
      const deltaPx = event.clientX - dragState.originX;
      const width = timelineRef.current?.clientWidth ?? 0;
      if (width === 0 || !timeline) return;
      const pxPerMs = width / timeline.totalMs;
      const deltaMs = deltaPx / pxPerMs;
      const snapped = Math.round(deltaMs / DAY_MS) * DAY_MS;
      setDragDeltaMs(snapped);
    };

    const handleUp = () => {
      if (!timeline || dragDeltaMs === 0) {
        setDragState(null);
        setDragDeltaMs(0);
        return;
      }

      let nextStart = dragState.originStart;
      let nextEnd = dragState.originEnd;

      if (dragState.mode === 'move') {
        nextStart += dragDeltaMs;
        nextEnd += dragDeltaMs;
      } else if (dragState.mode === 'start') {
        nextStart = Math.min(dragState.originEnd - DAY_MS, dragState.originStart + dragDeltaMs);
      } else if (dragState.mode === 'end') {
        nextEnd = Math.max(dragState.originStart + DAY_MS, dragState.originEnd + dragDeltaMs);
      }

      if (viewMode !== 'Day') {
        const snappedStart = snapToMonday(nextStart);
        if (Math.abs(snappedStart - nextStart) <= SNAP_THRESHOLD_MS) nextStart = snappedStart;

        const snappedEnd = snapToMonthEnd(nextEnd);
        if (Math.abs(snappedEnd - nextEnd) <= SNAP_THRESHOLD_MS) nextEnd = snappedEnd;
      }

      if (onUpdateTaskDates) {
        onUpdateTaskDates(dragState.id, nextStart, nextEnd);
      }

      setDragState(null);
      setDragDeltaMs(0);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, dragDeltaMs, onUpdateTaskDates, timeline, viewMode]);

  // Sync vertical scrolling between task list and timeline
  useEffect(() => {
    const listEl = listRef.current;
    const timelineEl = timelineRef.current;
    if (!listEl || !timelineEl) return;

    const handleListScroll = () => {
      if (isScrollingRightRef.current) return;
      isScrollingLeftRef.current = true;
      timelineEl.scrollTop = listEl.scrollTop;
      setTimeout(() => { isScrollingLeftRef.current = false; }, 0);
    };

    const handleTimelineScroll = () => {
      if (isScrollingLeftRef.current) return;
      isScrollingRightRef.current = true;
      listEl.scrollTop = timelineEl.scrollTop;
      setTimeout(() => { isScrollingRightRef.current = false; }, 0);
    };

    listEl.addEventListener('scroll', handleListScroll);
    timelineEl.addEventListener('scroll', handleTimelineScroll);

    return () => {
      listEl.removeEventListener('scroll', handleListScroll);
      timelineEl.removeEventListener('scroll', handleTimelineScroll);
    };
  }, []);

  if (tasks.length === 0 || !timeline) {
    return <div className="flex items-center justify-center h-full text-slate-500 italic">No tasks to display.</div>;
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(${timeline.ticks.length}, minmax(${minColumnWidths[viewMode]}px, 1fr))`,
  } as React.CSSProperties;

  const today = Date.now();
  const todayInRange = today >= timeline.startMs && today <= timeline.endMs;
  const todayLeft = ((today - timeline.startMs) / timeline.totalMs) * 100;

  const weekendBlocks = timeline.totalDays <= 400
    ? Array.from({ length: timeline.totalDays }).map((_, index) => {
        const dayMs = timeline.startMs + index * DAY_MS;
        const day = new Date(dayMs).getDay();
        if (day !== 0 && day !== 6) return null;
        const left = ((dayMs - timeline.startMs) / timeline.totalMs) * 100;
        const width = (DAY_MS / timeline.totalMs) * 100;
        return (
          <div
            key={dayMs}
            className="absolute top-0 bottom-0 bg-indigo-50/40"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })
    : null;

  const getDisplayDates = (task: typeof taskEntries[number]) => {
    if (!dragState || dragState.id !== task.id) {
      return { start: task.startMs, end: task.endMs };
    }

    if (dragState.mode === 'move') {
      return { start: task.startMs + dragDeltaMs, end: task.endMs + dragDeltaMs };
    }

    if (dragState.mode === 'start') {
      const start = Math.min(task.endMs - DAY_MS, task.startMs + dragDeltaMs);
      return { start, end: task.endMs };
    }

    const end = Math.max(task.startMs + DAY_MS, task.endMs + dragDeltaMs);
    return { start: task.startMs, end };
  };

  const leftFromMs = (ms: number) => ((ms - timeline.startMs) / timeline.totalMs) * 100;

  const taskCenters = taskEntries.reduce<Record<string, { x: number; y: number }>>((acc, task, index) => {
    const display = getDisplayDates(task);
    const left = leftFromMs(display.end);
    const y = index * 44 + 22;
    acc[task.id] = { x: left, y };
    return acc;
  }, {});

  const dependencyLines = taskEntries.flatMap((task, index) => {
    const predecessors = task.predecessors || [];
    if (predecessors.length === 0) return [];

    const target = taskCenters[task.id];
    if (!target) return [];

    return predecessors
      .map(ref => {
        const match = taskEntries.find(candidate => candidate.id === ref || candidate.wbs === ref);
        if (!match) return null;
        const source = taskCenters[match.id];
        if (!source) return null;
        const y1 = source.y;
        const y2 = target.y;
        const x1 = source.x;
        const targetStart = getDisplayDates(task).start;
        const x2 = leftFromMs(targetStart);
        const sourceEnd = getDisplayDates(match).end;
        const conflict = sourceEnd > targetStart;
        return {
          key: `${match.id}-${task.id}`,
          fromId: match.id,
          toId: task.id,
          x1,
          y1,
          x2,
          y2,
          conflict,
        };
      })
      .filter(Boolean) as Array<{
        key: string;
        fromId: string;
        toId: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        conflict: boolean;
      }>;
  });

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden relative shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={showList}
              onChange={() => setShowList(!showList)}
              className="rounded border-slate-300 text-primary focus:ring-primary"
            />
            Show Task List
          </label>
          <span className="text-[10px] text-slate-400">Drag bars to move or resize</span>
        </div>

        <div className="flex gap-1">
          <span className="text-xs text-slate-500 mr-2 self-center">Zoom:</span>
          {(['Day', 'Week', 'Month', 'Year'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 text-[10px] rounded border ${
                viewMode === mode
                  ? 'bg-white border-primary text-primary font-bold shadow-sm'
                  : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative select-none">
        <div className="flex h-full">
          {showList && (
            <div className="w-56 border-r border-slate-200 bg-white overflow-y-auto" ref={listRef}>
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                Tasks
              </div>
              {taskEntries.map(task => (
                <div
                  key={task.id}
                  className="px-3 py-2 border-b border-slate-100 text-xs text-slate-700"
                >
                  <div className="font-semibold text-slate-900 truncate">{task.title}</div>
                  <div className="text-[10px] text-slate-400">{task.assignee || 'Unassigned'}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-auto" ref={timelineRef}>
            <div className="min-w-[700px]">
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
                <div className="border-b border-slate-100 bg-white">
                  <div className="relative h-6 text-[10px] uppercase tracking-widest text-slate-400">
                    {timeline.monthSegments.map(segment => {
                      const left = leftFromMs(segment.start);
                      const width = leftFromMs(segment.end) - left;
                      if (width <= 0) return null;
                      return (
                        <div
                          key={segment.start}
                          className="absolute top-0 bottom-0 border-r border-slate-100 px-3 flex items-center"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {segment.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid text-[10px] uppercase tracking-widest text-slate-400" style={gridStyle}>
                  {timeline.ticks.map((tick, index) => {
                    const date = new Date(tick);
                    const showLabel = shouldLabelTick(date, viewMode, index);
                    return (
                      <div
                        key={`${tick}-${index}`}
                        className="px-3 py-2 border-r border-slate-100"
                      >
                        {showLabel ? formatTick(date, viewMode) : ''}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0">
                  {weekendBlocks}
                  {todayInRange && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-400"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                </div>

                <svg
                  className="absolute inset-0"
                  viewBox={`0 0 100 ${taskEntries.length * 44}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="arrow"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" fill="#a5b4fc" />
                    </marker>
                  </defs>
                  {dependencyLines.map(line => {
                    const midX = line.x1 + (line.x2 - line.x1) * 0.6;
                    const isHovered = hoveredDependency === line.key;
                    const isLinkedHover = hoveredTaskId === line.fromId || hoveredTaskId === line.toId;
                    const isSelectedLink = selectedTaskId === line.fromId || selectedTaskId === line.toId;
                    const stroke = line.conflict ? '#f87171' : '#a5b4fc';
                    const strokeWidth = isHovered || isLinkedHover || isSelectedLink ? 1.2 : 0.6;
                    return (
                      <path
                        key={line.key}
                        d={`M ${line.x1} ${line.y1} L ${midX} ${line.y1} L ${midX} ${line.y2} L ${line.x2} ${line.y2}`}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        fill="none"
                        markerEnd="url(#arrow)"
                        onMouseEnter={() => setHoveredDependency(line.key)}
                        onMouseLeave={() => setHoveredDependency(null)}
                        onClick={() => onSelectTask?.(line.fromId)}
                        className="cursor-pointer pointer-events-auto"
                      />
                    );
                  })}
                </svg>

                {taskEntries.map(task => {
                  const display = getDisplayDates(task);
                  const left = leftFromMs(display.start);
                  const width = leftFromMs(display.end) - left;
                  const safeWidth = Math.max(width, 1.5);
                  const color = getTaskColor(task.priority, task.isMilestone);
                  const progress = Math.min(100, Math.max(0, task.completion ?? 0));
                  const milestoneLeft = Math.min(100, left + safeWidth);
                  const isSelected = task.id === selectedTaskId;

                  return (
                    <div key={task.id} className="relative border-b border-slate-100 h-11">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4">
                        <div
                          className={`absolute h-4 rounded-full bg-slate-200 group ${isSelected ? 'ring-2 ring-indigo-400' : ''}`}
                          style={{ left: `${left}%`, width: `${safeWidth}%` }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setDragState({
                              id: task.id,
                              mode: 'move',
                              originX: event.clientX,
                              originStart: task.startMs,
                              originEnd: task.endMs,
                            });
                          }}
                          onClick={() => onSelectTask?.(task.id)}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId(prev => (prev === task.id ? null : prev))}
                          onMouseMove={(event) => {
                            const rect = timelineRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
                          }}
                          title={`${task.title} (${progress}%)`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${progress}%`, backgroundColor: color }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center px-2 text-[10px] font-semibold text-white drop-shadow-sm">
                            <span className="truncate">{task.title}</span>
                          </div>
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-2 cursor-ew-resize rounded-l-full bg-white/60"
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              setDragState({
                                id: task.id,
                                mode: 'start',
                                originX: event.clientX,
                                originStart: task.startMs,
                                originEnd: task.endMs,
                              });
                            }}
                          />
                          <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-2 cursor-ew-resize rounded-r-full bg-white/60"
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              setDragState({
                                id: task.id,
                                mode: 'end',
                                originX: event.clientX,
                                originStart: task.startMs,
                                originEnd: task.endMs,
                              });
                            }}
                          />
                        </div>
                        {task.isMilestone && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{ left: `${milestoneLeft}%` }}
                          >
                            <div className="h-3 w-3 rotate-45" style={{ backgroundColor: color }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {hoveredTaskId && (
                  <div
                    className="absolute z-20 rounded-lg border border-slate-100 bg-white p-3 text-xs text-slate-700 shadow-xl"
                    style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}
                  >
                    {(() => {
                      const task = taskEntries.find(item => item.id === hoveredTaskId);
                      if (!task) return null;
                      const display = getDisplayDates(task);
                      const start = new Date(display.start).toLocaleDateString();
                      const end = new Date(display.end).toLocaleDateString();
                      const duration = getDurationDays(display.start, display.end);
                      const baselineDuration = getDurationDays(task.startMs, task.endMs);
                      const deltaDays = duration - baselineDuration;
                      return (
                        <>
                          <div className="font-semibold text-slate-900 mb-1">{task.title}</div>
                          <div className="text-slate-500 mb-1">{start} - {end}</div>
                          <div className="text-slate-400">Duration: {duration}d</div>
                          <div className="font-semibold text-primary">Progress: {task.completion ?? 0}%</div>
                          {dragState?.id === task.id && (
                            <div className="text-[10px] text-indigo-500 mt-1">
                              {deltaDays === 0 ? 'Duration unchanged' : `Duration ${deltaDays > 0 ? '+' : ''}${deltaDays}d`}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
