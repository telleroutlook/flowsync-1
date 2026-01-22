import React, { useState, useEffect, useRef, useMemo } from 'react';
import { geminiService } from './services/geminiService';
import { ChatBubble } from './components/ChatBubble';
import { KanbanBoard } from './components/KanbanBoard';
import { ListView } from './components/ListView';
import { GanttChart } from './components/GanttChart';
import { ProjectSidebar } from './components/ProjectSidebar';
import { Task, ChatMessage, TaskStatus, Priority, TaskActionArgs, Project, ProjectActionArgs } from './types';

// Simple ID generator
const generateId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

type ViewMode = 'BOARD' | 'LIST' | 'GANTT';

// --- Mock Data Setup ---
const now = Date.now();
const day = 86400000;

const createDate = (offsetDays: number) => {
  const base = new Date('2026-01-01').getTime(); 
  return base + (offsetDays * day);
};

const clampCompletion = (value: number) => Math.min(100, Math.max(0, value));

const INITIAL_PROJECTS: Project[] = [
  { id: 'p3', name: 'Construction Phase 1', description: 'Main Building Construction WBS', icon: '🏗️' },
  { id: 'p1', name: 'Software Development', description: 'Main SaaS product development', icon: '💻' },
  { id: 'p2', name: 'Marketing Campaign', description: 'Q4 Launch Strategies', icon: '🚀' },
];

const INITIAL_TASKS: Task[] = [
  // --- Construction Project ---
  {
    id: 't1', projectId: 'p3', title: 'Project Initiation', wbs: '1', 
    status: TaskStatus.DONE, priority: Priority.HIGH, createdAt: now,
    startDate: createDate(0), dueDate: createDate(0), completion: 100, isMilestone: true, assignee: 'Owner Unit'
  },
  {
    id: 't1.1', projectId: 'p3', title: 'Approval & Reporting', wbs: '1.1', 
    status: TaskStatus.DONE, priority: Priority.HIGH, createdAt: now,
    startDate: createDate(0), dueDate: createDate(30), completion: 100, isMilestone: false, assignee: 'Owner Unit'
  },
  {
    id: 't1.2', projectId: 'p3', title: 'Construction Drawings', wbs: '1.2', 
    status: TaskStatus.DONE, priority: Priority.HIGH, createdAt: now,
    startDate: createDate(15), dueDate: createDate(60), completion: 90, isMilestone: false, assignee: 'Design Institute'
  },
  {
    id: 't2', projectId: 'p3', title: 'Construction Prep', wbs: '2', 
    status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, createdAt: now,
    startDate: createDate(30), dueDate: createDate(54), completion: 80, isMilestone: false, assignee: 'General Contractor'
  },
  {
    id: 't2.1', projectId: 'p3', title: 'Site Leveling', wbs: '2.1', 
    status: TaskStatus.DONE, priority: Priority.MEDIUM, createdAt: now,
    startDate: createDate(30), dueDate: createDate(40), completion: 100, isMilestone: false, assignee: 'General Contractor'
  },
  {
    id: 't3', projectId: 'p3', title: 'Foundation Works', wbs: '3', 
    status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, createdAt: now,
    startDate: createDate(60), dueDate: createDate(121), completion: 70, isMilestone: false, assignee: 'General Contractor'
  },
  {
    id: 't4', projectId: 'p3', title: 'Main Structure', wbs: '4', 
    status: TaskStatus.TODO, priority: Priority.HIGH, createdAt: now,
    startDate: createDate(120), dueDate: createDate(273), completion: 0, isMilestone: false, assignee: 'General Contractor'
  },
  {
    id: 't4.1', projectId: 'p3', title: 'Structure Cap', wbs: '4.1', 
    status: TaskStatus.TODO, priority: Priority.HIGH, createdAt: now,
    startDate: createDate(273), dueDate: createDate(273), completion: 0, isMilestone: true, assignee: 'General Contractor'
  },

  // --- Software Project ---
  { 
    id: '1', projectId: 'p1', title: 'Design System Draft', wbs: '1.0',
    status: TaskStatus.DONE, priority: Priority.HIGH, createdAt: now - (day * 3), 
    startDate: now - (day * 3), dueDate: now - day, completion: 100, assignee: 'Design Team'
  },
  { 
    id: '2', projectId: 'p1', title: 'Integrate Gemini API', wbs: '2.0',
    status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, createdAt: now - day,
    startDate: now, dueDate: now + (day * 2), completion: 45, assignee: 'Dev Team'
  },
];

type AppState = {
  projects: Project[];
  tasks: Task[];
  activeProjectId: string;
};

type ProjectActionResult = {
  projects: Project[];
  tasks: Task[];
  activeProjectId: string;
  message: string;
};

type TaskActionResult = {
  tasks: Task[];
  message: string;
};

const applyProjectAction = (state: AppState, args: ProjectActionArgs): ProjectActionResult => {
  const { projects, tasks, activeProjectId } = state;
  const { action, name, description, oldName } = args;

  switch (action) {
    case 'create': {
      if (!name) {
        return { projects, tasks, activeProjectId, message: 'Error: Project name required.' };
      }
      const newProj: Project = {
        id: generateId(),
        name,
        description: description || '',
        icon: name.charAt(0).toUpperCase(),
      };
      return {
        projects: [...projects, newProj],
        tasks,
        activeProjectId: newProj.id,
        message: `Project "${name}" created and selected.`,
      };
    }

    case 'select': {
      const target = projects.find(p =>
        p.name.toLowerCase().includes((name || oldName || '').toLowerCase())
      );
      if (target) {
        return {
          projects,
          tasks,
          activeProjectId: target.id,
          message: `Switched to project "${target.name}".`,
        };
      }
      return { projects, tasks, activeProjectId, message: `Error: Could not find project "${name}".` };
    }

    case 'delete': {
      const delTarget = projects.find(p =>
        p.name.toLowerCase().includes((name || oldName || '').toLowerCase())
      );
      if (delTarget) {
        if (projects.length <= 1) {
          return { projects, tasks, activeProjectId, message: 'Error: Cannot delete the last project.' };
        }
        const nextProjects = projects.filter(p => p.id !== delTarget.id);
        const nextTasks = tasks.filter(t => t.projectId !== delTarget.id);
        const nextActive =
          projects[0].id === delTarget.id ? projects[1].id : projects[0].id;
        return {
          projects: nextProjects,
          tasks: nextTasks,
          activeProjectId: nextActive,
          message: `Project "${delTarget.name}" deleted.`,
        };
      }
      return { projects, tasks, activeProjectId, message: 'Error: Could not find project to delete.' };
    }

    default:
      return { projects, tasks, activeProjectId, message: 'Unknown project action.' };
  }
};

const applyTaskAction = (state: AppState, args: TaskActionArgs): TaskActionResult => {
  const { tasks, activeProjectId } = state;
  const {
    action,
    title,
    description,
    status,
    priority,
    oldTitle,
    projectId,
    id,
    dueDate,
    startDate,
    completion,
    assignee,
    wbs,
    isMilestone,
  } = args;

  const mapStatus = (s?: string) => {
    if (s === 'in-progress') return TaskStatus.IN_PROGRESS;
    if (s === 'done') return TaskStatus.DONE;
    return TaskStatus.TODO;
  };

  const mapPriority = (p?: string) => {
    if (p === 'high') return Priority.HIGH;
    if (p === 'low') return Priority.LOW;
    return Priority.MEDIUM;
  };

  const parseDate = (dateStr?: string): number | undefined => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();
    return undefined;
  };

  switch (action) {
    case 'create': {
      if (!title) return { tasks, message: 'Error: Title required for creation.' };
      const normalizedCompletion = clampCompletion(completion ?? 0);
      const parsedStart = parseDate(startDate);
      const parsedDue = parseDate(dueDate);
      const targetProjectId = projectId || activeProjectId;
      const newTask: Task = {
        id: generateId(),
        projectId: targetProjectId,
        title,
        description: description || '',
        status: mapStatus(status),
        priority: mapPriority(priority),
        createdAt: Date.now(),
        startDate: parsedStart ?? Date.now(),
        dueDate: parsedDue,
        completion: normalizedCompletion,
        assignee: assignee || 'Unassigned',
        wbs: wbs || '',
        isMilestone: !!isMilestone,
      };
      return {
        tasks: [...tasks, newTask],
        message: `Task "${title}" created (WBS: ${wbs || 'N/A'}).`,
      };
    }

    case 'move':
    case 'update':
    case 'delete': {
      const targetProjectId = projectId || activeProjectId;
      const targetTask = id
        ? tasks.find(t => t.id === id && t.projectId === targetProjectId)
        : tasks.find(t =>
            t.projectId === targetProjectId &&
            t.title.toLowerCase().includes((oldTitle || title || '').toLowerCase())
          );

      if (!targetTask) {
        const label = id || oldTitle || title || 'unknown';
        return { tasks, message: `Error: Could not find task "${label}" in current project.` };
      }

      if (action === 'delete') {
        const deletedTitle = targetTask.title;
        return {
          tasks: tasks.filter(t => t.id !== targetTask.id),
          message: `Task "${deletedTitle}" deleted.`,
        };
      }

      const updatedTask = { ...targetTask };
      if (status) updatedTask.status = mapStatus(status);
      if (priority) updatedTask.priority = mapPriority(priority);
      if (description) updatedTask.description = description;
      if (startDate) {
        const parsedStart = parseDate(startDate);
        if (parsedStart !== undefined) updatedTask.startDate = parsedStart;
      }
      if (dueDate) {
        const parsedDue = parseDate(dueDate);
        if (parsedDue !== undefined) updatedTask.dueDate = parsedDue;
      }
      if (assignee) updatedTask.assignee = assignee;
      if (wbs) updatedTask.wbs = wbs;
      if (completion !== undefined) updatedTask.completion = clampCompletion(completion);
      if (isMilestone !== undefined) updatedTask.isMilestone = isMilestone;
      if (action === 'update' && title && title !== targetTask.title) updatedTask.title = title;

      return {
        tasks: tasks.map(t => (t.id === targetTask.id ? updatedTask : t)),
        message: `Task updated: ${updatedTask.title}`,
      };
    }

    default:
      return { tasks, message: 'Unknown action.' };
  }
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECTS[0].id);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [viewMode, setViewMode] = useState<ViewMode>('GANTT'); 
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I'm FlowSync. I've loaded your Construction Project WBS. I can help manage schedules, WBS codes, and assignees.",
      timestamp: Date.now(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || projects[0], [projects, activeProjectId]);
  const activeTasks = useMemo(() => tasks.filter(t => t.projectId === activeProjectId), [tasks, activeProjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleProjectAction = (args: ProjectActionArgs): string => {
    const result = applyProjectAction({ projects, tasks, activeProjectId }, args);
    setProjects(result.projects);
    setTasks(result.tasks);
    setActiveProjectId(result.activeProjectId);
    return result.message;
  };

  const handleTaskAction = (args: TaskActionArgs): string => {
    const result = applyTaskAction({ projects, tasks, activeProjectId }, args);
    setTasks(result.tasks);
    return result.message;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const maxContextTasks = 30;
      const limitedTasks = activeTasks.slice(0, maxContextTasks);
      const taskIdMap = limitedTasks.map(task => ({
        id: task.id,
        title: task.title,
      }));
      const wbsIdMap = limitedTasks
        .filter(task => task.wbs)
        .map(task => ({
          id: task.id,
          wbs: task.wbs || '',
        }));
      const shouldIncludeFullMappings = activeTasks.length > maxContextTasks;
      const mappingJson = shouldIncludeFullMappings
        ? JSON.stringify({
            limit: maxContextTasks,
            total: activeTasks.length,
            taskIdMap,
            wbsIdMap,
          })
        : JSON.stringify({
            total: activeTasks.length,
            taskIdMap,
          });
      const systemContext = `Active Project: ${activeProject.name}. 
                             Available Projects: ${projects.map(p => p.name).join(', ')}.
                             ${
                               shouldIncludeFullMappings
                                 ? `Task IDs in Active Project (JSON): ${mappingJson}.`
                                 : `Task IDs in Active Project (compact JSON): ${mappingJson}.`
                             }`;

      const response = await geminiService.sendMessage(history, userMsg.text, systemContext);

      let finalText = response.text;
      const toolResults: string[] = [];

      if (response.toolCalls && response.toolCalls.length > 0) {
        let draftState: AppState = { projects, tasks, activeProjectId };
        for (const call of response.toolCalls) {
          if (call.name === 'manageTasks') {
            const result = applyTaskAction(draftState, call.args as TaskActionArgs);
            draftState = { ...draftState, tasks: result.tasks };
            toolResults.push(result.message);
          } else if (call.name === 'manageProjects') {
            const result = applyProjectAction(draftState, call.args as ProjectActionArgs);
            draftState = {
              projects: result.projects,
              tasks: result.tasks,
              activeProjectId: result.activeProjectId,
            };
            toolResults.push(result.message);
          }
        }
        
        if (toolResults.length > 0) {
           setProjects(draftState.projects);
           setTasks(draftState.tasks);
           setActiveProjectId(draftState.activeProjectId);
           const resultMsg = toolResults.join(" | ");
           setMessages(prev => [...prev, {
             id: generateId(),
             role: 'system',
             text: resultMsg,
             timestamp: Date.now()
           }]);
           
           if (!finalText) finalText = "Updates applied to the project board.";
        }
      }

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: finalText || "Processed.",
        timestamp: Date.now()
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: "Sorry, something went wrong.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const manualCreateProject = () => {
    const name = prompt("Enter project name:");
    if (name) handleProjectAction({ action: 'create', name });
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-slate-900 font-sans">
      
      {/* 1. Chat Interface (Left) */}
      <div className="w-[320px] flex flex-col border-r border-slate-200 bg-white relative z-20 shrink-0 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight">FlowSync</h1>
            <p className="text-xs text-slate-500">AI Assistant</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isProcessing && (
            <div className="flex justify-start mb-4 animate-pulse">
               <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                  </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <form onSubmit={handleSendMessage} className="relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask AI (e.g., 'Update schedule')"
              className="w-full bg-slate-50 text-slate-900 pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-400 text-sm"
              disabled={isProcessing}
            />
            <button 
              type="submit" 
              disabled={!inputText.trim() || isProcessing}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* 2. Project Sidebar (Middle-Left) */}
      <ProjectSidebar 
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateProject={manualCreateProject}
        onDeleteProject={(id) => handleProjectAction({ action: 'delete', name: projects.find(p => p.id === id)?.name })}
      />

      {/* 3. Workspace (Right) */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{activeProject.name}</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{activeProject.description || 'Project Workspace'}</p>
            </div>
            
            {/* View Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 ml-4">
               <button 
                 onClick={() => setViewMode('BOARD')}
                 className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'BOARD' ? 'bg-white text-primary shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Board
               </button>
               <button 
                 onClick={() => setViewMode('LIST')}
                 className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'LIST' ? 'bg-white text-primary shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 List
               </button>
               <button 
                 onClick={() => setViewMode('GANTT')}
                 className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'GANTT' ? 'bg-white text-primary shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Gantt
               </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-700 font-bold text-xs">AI</div>
             </div>
          </div>
        </div>

        {/* View Area */}
        <div className="p-6 flex-1 overflow-hidden relative z-10">
           {viewMode === 'BOARD' && <KanbanBoard tasks={activeTasks} />}
           {viewMode === 'LIST' && <ListView tasks={activeTasks} />}
           {viewMode === 'GANTT' && <GanttChart tasks={activeTasks} />}
        </div>
        
      </div>
    </div>
  );
}
