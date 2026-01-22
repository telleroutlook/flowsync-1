import React, { useMemo, useState } from 'react';
import { Task, Priority } from '../types';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';

interface GanttChartProps {
  tasks: Task[];
}

// Helper to map our priority enum to colors
const getTaskColor = (priority: Priority, isMilestone?: boolean) => {
  if (isMilestone) return '#8b5cf6'; // Accent (Violet)
  switch (priority) {
    case Priority.HIGH: return '#ef4444'; // Red
    case Priority.MEDIUM: return '#eab308'; // Yellow
    case Priority.LOW: return '#22c55e'; // Green
    default: return '#6366f1'; // Primary
  }
};

export const GanttChart: React.FC<GanttChartProps> = ({ tasks }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [isChecked, setIsChecked] = useState(true); // Toggle list view

  // 1. Data Adapter: Convert our Task[] to Library's Task[]
  const ganttTasks: GanttTask[] = useMemo(() => {
    if (tasks.length === 0) return [];

    return tasks.map(t => {
      // Ensure valid dates
      const start = t.startDate ? new Date(t.startDate) : new Date(t.createdAt);
      const end = t.dueDate ? new Date(t.dueDate) : new Date(start.getTime() + 86400000);
      
      // Handle edge case where end < start due to bad data
      if (end <= start) end.setDate(start.getDate() + 1);

      return {
        start,
        end,
        name: t.title,
        id: t.id,
        type: t.isMilestone ? 'milestone' : 'task',
        progress: t.completion || 0,
        isDisabled: true, // Read-only for now
        styles: {
          progressColor: getTaskColor(t.priority, t.isMilestone),
          progressSelectedColor: '#fff',
          // Light Mode Colors
          backgroundColor: '#e2e8f0', // slate-200 for the bar background
          backgroundSelectedColor: '#cbd5e1',
        },
        displayOrder: t.wbs ? parseInt(t.wbs.replace('.', '')) : 1,
        dependencies: t.predecessors
      };
    }).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks]);

  if (tasks.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-500 italic">No tasks to display.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden relative shadow-sm">
      
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0 z-10">
         <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none font-medium">
                <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={() => setIsChecked(!isChecked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                Show Task List
            </label>
         </div>

         <div className="flex gap-1">
             <span className="text-xs text-slate-500 mr-2 self-center">Zoom:</span>
             <button onClick={() => setViewMode(ViewMode.Day)} className={`px-2 py-1 text-[10px] rounded border ${viewMode === ViewMode.Day ? 'bg-white border-primary text-primary font-bold shadow-sm' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white'}`}>Day</button>
             <button onClick={() => setViewMode(ViewMode.Week)} className={`px-2 py-1 text-[10px] rounded border ${viewMode === ViewMode.Week ? 'bg-white border-primary text-primary font-bold shadow-sm' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white'}`}>Week</button>
             <button onClick={() => setViewMode(ViewMode.Month)} className={`px-2 py-1 text-[10px] rounded border ${viewMode === ViewMode.Month ? 'bg-white border-primary text-primary font-bold shadow-sm' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white'}`}>Month</button>
             <button onClick={() => setViewMode(ViewMode.Year)} className={`px-2 py-1 text-[10px] rounded border ${viewMode === ViewMode.Year ? 'bg-white border-primary text-primary font-bold shadow-sm' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white'}`}>Year</button>
         </div>
      </div>

      {/* Gantt Container - Native Library Styling */}
      <div className="flex-1 overflow-hidden relative">
         <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            listCellWidth={isChecked ? "180px" : ""}
            columnWidth={viewMode === ViewMode.Month ? 100 : 65}
            barBackgroundColor="#e2e8f0"
            barBackgroundSelectedColor="#cbd5e1"
            barFill={60}
            barCornerRadius={4}
            fontSize="12px"
            rowHeight={40}
            headerHeight={40}
            todayColor="rgba(79, 70, 229, 0.1)" // Light Indigo
            
            // Custom Tooltip
            TooltipContent={({ task, fontSize, fontFamily }) => {
                return (
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-xl text-xs text-slate-700">
                        <div className="font-bold text-slate-900 mb-1">{task.name}</div>
                        <div className="text-slate-500 mb-1">{task.start.toLocaleDateString()} - {task.end.toLocaleDateString()}</div>
                        <div className="font-semibold text-primary">Progress: {task.progress}%</div>
                    </div>
                );
            }}
         />
      </div>
      
      {/* 
         Small tweak to ensure the library's default white background 
         blends perfectly if there are any gaps 
      */}
      <style>{`
        ._3_y5_ { background-color: #ffffff !important; }
      `}</style>
    </div>
  );
};