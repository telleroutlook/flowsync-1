import React, { useState, useEffect, useRef, useMemo } from 'react';
import { geminiService } from './services/geminiService';
import { ChatBubble } from './components/ChatBubble';
import { KanbanBoard } from './components/KanbanBoard';
import { ListView } from './components/ListView';
import { GanttChart } from './components/GanttChart';
import { ProjectSidebar } from './components/ProjectSidebar';
import { Task, ChatMessage, ChatAttachment, TaskStatus, Priority, TaskActionArgs, Project, ProjectActionArgs } from './types';

// Simple ID generator
const generateId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

type ViewMode = 'BOARD' | 'LIST' | 'GANTT';
type ExportFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'pdf' | 'xlsx';
type ExportScope = 'active' | 'all';
type ImportStrategy = 'append' | 'merge';

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

  const getTaskStart = (task: Task) => task.startDate ?? task.createdAt;
  const getTaskEnd = (task: Task) => {
    const start = getTaskStart(task);
    const end = task.dueDate ?? start + day;
    return end <= start ? start + day : end;
  };

  const resolveTaskConflicts = (task: Task, allTasks: Task[]) => {
    const predecessors = task.predecessors || [];
    if (predecessors.length === 0) return { task, changed: false };
    const start = getTaskStart(task);
    const end = getTaskEnd(task);
    let maxEnd = start;
    for (const ref of predecessors) {
      const match = allTasks.find(
        t => t.projectId === task.projectId && (t.id === ref || t.wbs === ref)
      );
      if (match) {
        maxEnd = Math.max(maxEnd, getTaskEnd(match));
      }
    }
    if (maxEnd <= start) return { task, changed: false };
    const duration = Math.max(day, end - start);
    const nextStart = maxEnd;
    const nextEnd = Math.max(nextStart + day, nextStart + duration);
    return { task: { ...task, startDate: nextStart, dueDate: nextEnd }, changed: true };
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

    case 'resolve-dependency-conflicts': {
      const targetProjectId = projectId || activeProjectId;
      const scopedTasks = tasks.filter(t => t.projectId === targetProjectId);
      const targetTask = id
        ? scopedTasks.find(t => t.id === id)
        : scopedTasks.find(t =>
            t.title.toLowerCase().includes((oldTitle || title || '').toLowerCase())
          );

      if (id || title || oldTitle) {
        if (!targetTask) {
          const label = id || oldTitle || title || 'unknown';
          return { tasks, message: `Error: Could not find task "${label}" in current project.` };
        }
        const result = resolveTaskConflicts(targetTask, tasks);
        if (!result.changed) {
          return { tasks, message: `No dependency conflicts found for "${targetTask.title}".` };
        }
        return {
          tasks: tasks.map(t => (t.id === targetTask.id ? result.task : t)),
          message: `Resolved dependency conflicts for "${targetTask.title}".`,
        };
      }

      let changedCount = 0;
      const resolvedTasks = tasks.map(task => {
        if (task.projectId !== targetProjectId) return task;
        const result = resolveTaskConflicts(task, tasks);
        if (result.changed) changedCount += 1;
        return result.task;
      });

      return {
        tasks: resolvedTasks,
        message:
          changedCount === 0
            ? 'No dependency conflicts found in the active project.'
            : `Resolved dependency conflicts for ${changedCount} task(s).`,
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('active');
  const [lastExportFormat, setLastExportFormat] = useState<ExportFormat>('csv');
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('append');
  const importInputRef = useRef<HTMLInputElement>(null);
  
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
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || projects[0], [projects, activeProjectId]);
  const activeTasks = useMemo(() => tasks.filter(t => t.projectId === activeProjectId), [tasks, activeProjectId]);
  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find(task => task.id === selectedTaskId) ?? null : null),
    [tasks, selectedTaskId]
  );
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedTaskId && !tasks.find(task => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    const storedScope = window.localStorage.getItem('flowsync:exportScope');
    const storedFormat = window.localStorage.getItem('flowsync:exportFormat');
    const storedImportStrategy = window.localStorage.getItem('flowsync:importStrategy');
    if (storedScope === 'active' || storedScope === 'all') {
      setExportScope(storedScope);
    }
    if (storedFormat === 'csv' || storedFormat === 'tsv' || storedFormat === 'json' || storedFormat === 'markdown' || storedFormat === 'pdf' || storedFormat === 'xlsx') {
      setLastExportFormat(storedFormat);
    }
    if (storedImportStrategy === 'append' || storedImportStrategy === 'merge') {
      setImportStrategy(storedImportStrategy);
    }
  }, []);

  useEffect(() => {
    if (!isExportOpen) return;
    const handleWindowClick = () => setIsExportOpen(false);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isExportOpen]);

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
    if (isProcessing) return;
    const cleanedInput = inputText.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!cleanedInput && !hasAttachments) return;
    const outgoingText = cleanedInput || 'Sent attachment(s).';

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: outgoingText,
      timestamp: Date.now(),
      attachments: hasAttachments ? pendingAttachments : undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setPendingAttachments([]);
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

  const handleAttachFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextAttachments = Array.from(files).map(file => ({
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    setPendingAttachments(prev => [...prev, ...nextAttachments]);
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments(prev => {
      const target = prev.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(item => item.id !== id);
    });
  };

  const manualCreateProject = () => {
    const name = prompt("Enter project name:");
    if (name) handleProjectAction({ action: 'create', name });
  };

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

  const getTaskStart = (task: Task) => task.startDate ?? task.createdAt;
  const getTaskEnd = (task: Task) => {
    const start = getTaskStart(task);
    const end = task.dueDate ?? start + day;
    return end <= start ? start + day : end;
  };

  const formatExportDate = (value?: number) => {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 10);
  };

  const parseDateFlexible = (value?: string) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) return numeric;
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
    return undefined;
  };

  const makeSafeFileName = (value: string) => {
    const cleaned = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return cleaned || 'project';
  };

  const formatCsvValue = (value: string, delimiter: string) => {
    const escaped = value.replace(/"/g, '""');
    if (escaped.includes('"') || escaped.includes('\n') || escaped.includes(delimiter)) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  const exportHeaders = [
    'project',
    'id',
    'title',
    'status',
    'priority',
    'assignee',
    'wbs',
    'startDate',
    'dueDate',
    'completion',
    'isMilestone',
    'predecessors',
    'description',
    'createdAt',
  ];

  const buildExportRows = (scope: ExportScope) => {
    const projectLookup = projects.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
    const sourceTasks = scope === 'all' ? tasks : activeTasks;
    return sourceTasks.map(task => {
      const project = projectLookup[task.projectId] || activeProject;
      return {
        project: project.name,
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee || '',
        wbs: task.wbs || '',
        startDate: formatExportDate(getTaskStart(task)),
        dueDate: formatExportDate(getTaskEnd(task)),
        completion: task.completion ?? 0,
        isMilestone: task.isMilestone ? 'yes' : 'no',
        predecessors: (task.predecessors || []).join(','),
        description: task.description || '',
        createdAt: formatExportDate(task.createdAt),
      };
    });
  };

  const makeSheetName = (value: string, usedNames: Set<string>) => {
    const base = value
      .replace(/[\[\]\:\*\?\/\\]/g, '')
      .trim()
      .slice(0, 31) || 'Sheet';
    let name = base;
    let counter = 1;
    while (usedNames.has(name)) {
      const suffix = `-${counter}`;
      name = base.slice(0, Math.max(1, 31 - suffix.length)) + suffix;
      counter += 1;
    }
    usedNames.add(name);
    return name;
  };

  const recordExportPreference = (format: ExportFormat, scope: ExportScope) => {
    setLastExportFormat(format);
    window.localStorage.setItem('flowsync:exportFormat', format);
    window.localStorage.setItem('flowsync:exportScope', scope);
  };

  const recordImportPreference = (strategy: ImportStrategy) => {
    setImportStrategy(strategy);
    window.localStorage.setItem('flowsync:importStrategy', strategy);
  };

  const normalizeStatus = (value?: string): TaskStatus => {
    const normalized = (value || '').toUpperCase();
    if (normalized === 'DONE') return TaskStatus.DONE;
    if (normalized === 'IN_PROGRESS' || normalized === 'IN-PROGRESS' || normalized === 'IN PROGRESS') {
      return TaskStatus.IN_PROGRESS;
    }
    return TaskStatus.TODO;
  };

  const normalizePriority = (value?: string): Priority => {
    const normalized = (value || '').toUpperCase();
    if (normalized === 'HIGH') return Priority.HIGH;
    if (normalized === 'MEDIUM') return Priority.MEDIUM;
    return Priority.LOW;
  };

  const parseDelimitedLine = (line: string, delimiter: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === delimiter && !inQuotes) {
        cells.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    cells.push(current);
    return cells.map(cell => cell.trim());
  };

  const parseDelimitedContent = (content: string) => {
    const delimiter = content.includes('\t') ? '\t' : ',';
    const rows = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rows.length === 0) return [];
    const headers = parseDelimitedLine(rows[0], delimiter).map(h => h.trim().toLowerCase());
    return rows.slice(1).map(line => {
      const cells = parseDelimitedLine(line, delimiter);
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? '';
      });
      return record;
    });
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const lowerName = file.name.toLowerCase();
      let importedProjects: Project[] = [];
      let importedTasks: Task[] = [];

      if (lowerName.endsWith('.json')) {
        try {
          const payload = JSON.parse(content) as {
            projects?: Project[];
            tasks?: Array<Record<string, unknown>>;
          };
          if (Array.isArray(payload.projects)) {
            importedProjects = payload.projects.filter(item => item && typeof item.name === 'string');
          }
          if (Array.isArray(payload.tasks)) {
            importedTasks = payload.tasks.map((raw) => {
              const record = raw as Record<string, unknown>;
              const projectName = typeof record.project === 'string' ? record.project : activeProject.name;
              const project = importedProjects.find(item => item.name === projectName)
                || projects.find(item => item.name === projectName)
                || activeProject;
              return {
                id: typeof record.id === 'string' ? record.id : generateId(),
                projectId: project.id,
                title: typeof record.title === 'string' ? record.title : 'Untitled Task',
                description: typeof record.description === 'string' ? record.description : undefined,
                status: normalizeStatus(typeof record.status === 'string' ? record.status : undefined),
                priority: normalizePriority(typeof record.priority === 'string' ? record.priority : undefined),
                wbs: typeof record.wbs === 'string' ? record.wbs : undefined,
                createdAt: parseDateFlexible(typeof record.createdAt === 'string' ? record.createdAt : undefined) || Date.now(),
                startDate: parseDateFlexible(typeof record.startDate === 'string' ? record.startDate : undefined),
                dueDate: parseDateFlexible(typeof record.dueDate === 'string' ? record.dueDate : undefined),
                completion: typeof record.completion === 'number' ? clampCompletion(record.completion) : undefined,
                assignee: typeof record.assignee === 'string' ? record.assignee : undefined,
                isMilestone: record.isMilestone === 'yes' || record.isMilestone === true,
                predecessors: typeof record.predecessors === 'string'
                  ? record.predecessors.split(',').map(item => item.trim()).filter(Boolean)
                  : undefined,
              };
            });
          }
        } catch {
          alert('Import failed: invalid JSON file.');
          return;
        }
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const records = parseDelimitedContent(content);
        importedTasks = records.map(record => {
          const projectName = record.project || activeProject.name;
          const existingProject = projects.find(item => item.name === projectName);
          const project = existingProject || { id: generateId(), name: projectName, description: '', icon: projectName.charAt(0).toUpperCase() };
          if (!existingProject) {
            importedProjects.push(project);
          }
          return {
            id: record.id ? record.id : generateId(),
            projectId: project.id,
            title: record.title || 'Untitled Task',
            description: record.description || undefined,
            status: normalizeStatus(record.status),
            priority: normalizePriority(record.priority),
            wbs: record.wbs || undefined,
            createdAt: parseDateFlexible(record.createdat) || Date.now(),
            startDate: parseDateFlexible(record.startdate),
            dueDate: parseDateFlexible(record.duedate),
            completion: record.completion ? clampCompletion(Number(record.completion)) : undefined,
            assignee: record.assignee || undefined,
            isMilestone: (record.ismilestone || '').toLowerCase() === 'yes',
            predecessors: record.predecessors ? record.predecessors.split(',').map(item => item.trim()).filter(Boolean) : undefined,
          };
        });
      } else {
        alert('Import failed: only JSON, CSV, or TSV files are supported.');
        return;
      }

      if (importedTasks.length === 0) {
        alert('No tasks found in the import file.');
        return;
      }

      const existingIds = new Set(tasks.map(task => task.id));
      const normalizedTasks = importedTasks.map(task => ({
        ...task,
        id: importStrategy === 'append' && existingIds.has(task.id) ? generateId() : task.id,
      }));

      setProjects(prev => {
        const next = [...prev];
        importedProjects.forEach(project => {
          if (!next.find(item => item.name === project.name)) {
            next.push(project);
          }
        });
        return next;
      });
      if (importStrategy === 'merge') {
        setTasks(prev => {
          const map = new Map(prev.map(task => [task.id, task]));
          normalizedTasks.forEach(task => {
            map.set(task.id, task);
          });
          return Array.from(map.values());
        });
        alert(`Merged ${normalizedTasks.length} tasks by ID.`);
      } else {
        setTasks(prev => [...prev, ...normalizedTasks]);
        alert(`Imported ${normalizedTasks.length} tasks.`);
      }
    };
    reader.readAsText(file);
  };

  const exportTasks = async (format: ExportFormat, scope: ExportScope) => {
    const exportDate = new Date();
    const fileStamp = exportDate.toISOString().slice(0, 10);
    const scopeLabel = scope === 'all' ? 'all-projects' : makeSafeFileName(activeProject.name);
    const baseName = `${scopeLabel}-tasks-${fileStamp}`;
    const rows = buildExportRows(scope);

    if (format === 'json') {
      const payload = {
        scope,
        exportedAt: exportDate.toISOString(),
        projects: scope === 'all' ? projects : [activeProject],
        tasks: rows,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.json`;
      link.click();
      URL.revokeObjectURL(url);
      recordExportPreference(format, scope);
      return;
    }

    if (format === 'xlsx') {
      const XLSX = await import('xlsx');
      const headers = exportHeaders;
      const workbook = XLSX.utils.book_new();
      const usedNames = new Set<string>();
      const toRows = (dataRows: typeof rows) => dataRows.map(row => ([
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
        row.description,
        row.createdAt,
      ]));

      if (scope === 'all') {
        const allSheet = XLSX.utils.aoa_to_sheet([headers, ...toRows(rows)]);
        XLSX.utils.book_append_sheet(workbook, allSheet, makeSheetName('All Tasks', usedNames));
        projects.forEach(project => {
          const projectRows = rows.filter(row => row.project === project.name);
          if (projectRows.length === 0) return;
          const projectSheet = XLSX.utils.aoa_to_sheet([headers, ...toRows(projectRows)]);
          XLSX.utils.book_append_sheet(workbook, projectSheet, makeSheetName(project.name, usedNames));
        });
      } else {
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...toRows(rows)]);
        XLSX.utils.book_append_sheet(workbook, sheet, makeSheetName(activeProject.name, usedNames));
      }
      XLSX.writeFile(workbook, `${baseName}.xlsx`);
      recordExportPreference(format, scope);
      return;
    }

    if (format === 'pdf') {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
      const headers = exportHeaders.slice(0, 12);
      const body = rows.map(row => ([
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
      ]));
      doc.setFontSize(12);
      doc.text(
        scope === 'all' ? 'All Projects - Task Export' : `${activeProject.name} - Task Export`,
        40,
        32
      );
      doc.setFontSize(9);
      doc.text(`Exported: ${exportDate.toISOString()}`, 40, 48);
      autoTable(doc, {
        head: [headers],
        body,
        startY: 64,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 60 },
          2: { cellWidth: 150 },
          3: { cellWidth: 70 },
          4: { cellWidth: 70 },
          5: { cellWidth: 80 },
          6: { cellWidth: 50 },
          7: { cellWidth: 60 },
          8: { cellWidth: 60 },
          9: { cellWidth: 70 },
          10: { cellWidth: 70 },
          11: { cellWidth: 100 },
        },
        margin: { left: 40, right: 40 },
      });
      doc.save(`${baseName}.pdf`);
      recordExportPreference(format, scope);
      return;
    }

    if (format === 'markdown') {
      const payload = {
        scope,
        exportedAt: exportDate.toISOString(),
      };
      const headers = exportHeaders;
      const escapeMd = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const body = rows.map(row => [
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
        row.description,
        row.createdAt,
      ].map(cell => escapeMd(String(cell))).join(' | '));

      const markdown = [
        `# ${scope === 'all' ? 'All Projects' : activeProject.name} Tasks`,
        '',
        `Exported: ${payload.exportedAt}`,
        '',
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...body.map(line => `| ${line} |`),
        '',
      ].join('\n');

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.md`;
      link.click();
      URL.revokeObjectURL(url);
      recordExportPreference(format, scope);
      return;
    }

    const delimiter = format === 'tsv' ? '\t' : ',';
    const headers = exportHeaders;
    const lines = [
      headers.join(delimiter),
      ...rows.map(row => [
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
        row.description,
        row.createdAt,
      ].map(value => formatCsvValue(String(value), delimiter)).join(delimiter)),
    ];

    const mime = format === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
    const blob = new Blob([lines.join('\n')], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    recordExportPreference(format, scope);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. Chat Interface (Left) */}
      <div className="w-[340px] flex flex-col border-r border-slate-200 bg-white relative z-20 shrink-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
        <div className="h-16 px-5 border-b border-slate-100 flex items-center gap-3 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 ring-1 ring-black/5">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-900 tracking-tight leading-tight">FlowSync</h1>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">AI Assistant Online</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 scroll-smooth">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isProcessing && (
            <div className="flex justify-start mb-4 animate-fade-in">
               <div className="bg-white px-4 py-3.5 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Thinking</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                  </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-20">
          <form onSubmit={handleSendMessage} className="relative group">
            {pendingAttachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 animate-slide-up">
                {pendingAttachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs text-indigo-700"
                  >
                    <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="text-indigo-400 hover:text-indigo-700 p-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-inner">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(event) => {
                  handleAttachFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                disabled={isProcessing}
                title="Attach files"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask AI to update tasks..."
                className="w-full bg-transparent text-slate-900 py-2.5 outline-none placeholder:text-slate-400 text-sm font-medium"
                disabled={isProcessing}
              />
              
              <button 
                type="submit"
                disabled={(inputText.trim().length === 0 && pendingAttachments.length === 0) || isProcessing}
                className="h-9 w-9 shrink-0 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-200"
              >
                <svg className="w-4 h-4 translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
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
      <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-slate-800 leading-tight">{activeProject.name}</h2>
              <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                 <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{activeProject.description || 'Workspace'}</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-200 mx-2"></div>

            {/* View Switcher */}
            <div className="flex p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 backdrop-blur-sm">
               {['BOARD', 'LIST', 'GANTT'].map((mode) => (
                 <button 
                   key={mode}
                   onClick={() => setViewMode(mode as ViewMode)}
                   className={`px-3.5 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-all ${
                     viewMode === mode 
                       ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                       : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                   }`}
                 >
                   {mode}
                 </button>
               ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
               <input
                 ref={importInputRef}
                 type="file"
                 accept=".json,.csv,.tsv"
                 className="hidden"
                 onChange={(event) => {
                   const file = event.target.files?.[0];
                   if (file) handleImportFile(file);
                   event.currentTarget.value = '';
                 }}
               />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span>Import</span>
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <select
                value={importStrategy}
                onChange={(event) => recordImportPreference(event.target.value as ImportStrategy)}
                className="bg-transparent text-[10px] font-medium text-slate-500 outline-none cursor-pointer hover:text-indigo-600"
                aria-label="Import strategy"
              >
                <option value="append">Append</option>
                <option value="merge">Merge ID</option>
              </select>
             </div>

             <div className="relative">
               <button
                 type="button"
                 onClick={(event) => {
                   event.stopPropagation();
                   setIsExportOpen(prev => !prev);
                 }}
                 className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
               >
                 <span>Export</span>
                 <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </button>
               {isExportOpen && (
                 <div
                   onClick={(event) => event.stopPropagation()}
                   className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 z-50 p-2 animate-fade-in"
                 >
                   <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Export Scope</div>
                   <div className="flex gap-1 p-1 bg-slate-50 rounded-lg mb-2">
                     <button
                       type="button"
                       onClick={() => setExportScope('active')}
                       className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-all ${
                         exportScope === 'active'
                           ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                           : 'text-slate-500 hover:text-slate-700'
                       }`}
                     >
                       Current Project
                     </button>
                     <button
                       type="button"
                       onClick={() => setExportScope('all')}
                       className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-all ${
                         exportScope === 'all'
                           ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                           : 'text-slate-500 hover:text-slate-700'
                       }`}
                     >
                       All Projects
                     </button>
                   </div>
                   
                   <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Format</div>
                   <div className="grid grid-cols-1 gap-0.5">
                     {([
                       { id: 'csv', label: 'CSV', desc: 'Spreadsheet compatible' },
                       { id: 'xlsx', label: 'Excel', desc: 'Formatted workbook' },
                       { id: 'pdf', label: 'PDF', desc: 'Document view' },
                       { id: 'json', label: 'JSON', desc: 'Raw data' },
                       { id: 'markdown', label: 'Markdown', desc: 'Documentation' },
                     ] as const).map(item => (
                       <button
                         key={item.id}
                         type="button"
                         onClick={() => {
                           void exportTasks(item.id, exportScope);
                           setIsExportOpen(false);
                         }}
                         className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                           lastExportFormat === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                         }`}
                       >
                         <div className="flex flex-col items-start">
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-[9px] opacity-70 group-hover:opacity-100">{item.desc}</span>
                         </div>
                         {lastExportFormat === item.id && <span className="text-indigo-500">✓</span>}
                       </button>
                     ))}
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* View Area */}
        <div className="p-6 flex-1 overflow-hidden relative z-10">
            {viewMode === 'BOARD' && <KanbanBoard tasks={activeTasks} />}
            {viewMode === 'LIST' && <ListView tasks={activeTasks} />}
            {viewMode === 'GANTT' && (
              <div className="flex h-full gap-6">
                <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <GanttChart
                    tasks={activeTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={(id) => setSelectedTaskId(id)}
                    onUpdateTaskDates={(id, startDate, dueDate) => {
                      setTasks(prev =>
                        prev.map(task =>
                          task.id === id
                            ? { ...task, startDate, dueDate }
                            : task
                        )
                      );
                    }}
                  />
                </div>
                <div className={`w-[300px] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col transition-all duration-300 ${selectedTask ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-50 pointer-events-none'}`}>
                  {selectedTask ? (
                    <>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Task Details</span>
                        {selectedTask.isMilestone && (
                           <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-200">Milestone</span>
                        )}
                      </div>
                      <button onClick={() => setSelectedTaskId(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                      
                      {/* Title */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Title</label>
                        <input
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                          value={selectedTask.title}
                          onChange={(event) => {
                            const title = event.target.value;
                            setTasks(prev =>
                              prev.map(task =>
                                task.id === selectedTask.id
                                  ? { ...task, title }
                                  : task
                              )
                            );
                          }}
                        />
                      </div>

                      {/* Status & Priority */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-indigo-500 outline-none"
                            value={selectedTask.status}
                            onChange={(event) => {
                              const status = event.target.value as TaskStatus;
                              setTasks(prev =>
                                prev.map(task =>
                                  task.id === selectedTask.id
                                    ? { ...task, status }
                                    : task
                                )
                              );
                            }}
                          >
                            <option value={TaskStatus.TODO}>Todo</option>
                            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                            <option value={TaskStatus.DONE}>Done</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-indigo-500 outline-none"
                            value={selectedTask.priority}
                            onChange={(event) => {
                              const priority = event.target.value as Priority;
                              setTasks(prev =>
                                prev.map(task =>
                                  task.id === selectedTask.id
                                    ? { ...task, priority }
                                    : task
                                )
                              );
                            }}
                          >
                            <option value={Priority.LOW}>Low</option>
                            <option value={Priority.MEDIUM}>Medium</option>
                            <option value={Priority.HIGH}>High</option>
                          </select>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase">Start Date</label>
                            <input
                              type="date"
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 outline-none"
                              value={formatDateInput(selectedTask.startDate ?? selectedTask.createdAt)}
                              onChange={(event) => {
                                const startDate = parseDateInput(event.target.value);
                                if (!startDate) return;
                                setTasks(prev =>
                                  prev.map(task =>
                                    task.id === selectedTask.id
                                      ? { ...task, startDate }
                                      : task
                                  )
                                );
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase">Due Date</label>
                            <input
                              type="date"
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 outline-none"
                              value={formatDateInput(selectedTask.dueDate)}
                              onChange={(event) => {
                                const dueDate = parseDateInput(event.target.value);
                                if (!dueDate) return;
                                setTasks(prev =>
                                  prev.map(task =>
                                    task.id === selectedTask.id
                                      ? { ...task, dueDate }
                                      : task
                                  )
                                );
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Assignee & WBS */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assignee</label>
                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 outline-none"
                            placeholder="Unassigned"
                            value={selectedTask.assignee || ''}
                            onChange={(event) => {
                              const assignee = event.target.value;
                              setTasks(prev =>
                                prev.map(task =>
                                  task.id === selectedTask.id
                                    ? { ...task, assignee }
                                    : task
                                )
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">WBS Code</label>
                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 font-mono focus:border-indigo-500 outline-none"
                            placeholder="1.0"
                            value={selectedTask.wbs || ''}
                            onChange={(event) => {
                              const wbs = event.target.value;
                              setTasks(prev =>
                                prev.map(task =>
                                  task.id === selectedTask.id
                                    ? { ...task, wbs }
                                    : task
                                )
                              );
                            }}
                          />
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                           <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completion</label>
                           <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selectedTask.completion ?? 0}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={selectedTask.completion ?? 0}
                          onChange={(event) => {
                            const completion = clampCompletion(Number(event.target.value));
                            setTasks(prev =>
                              prev.map(task =>
                                task.id === selectedTask.id
                                  ? { ...task, completion }
                                  : task
                              )
                            );
                          }}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      {/* Dependencies */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          Dependencies
                          <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">{predecessorDetails.length}</span>
                        </label>
                        <div className="relative">
                          <input
                            className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-xs text-slate-700 focus:border-indigo-500 outline-none"
                            placeholder="Add IDs (e.g. t1, 1.2)..."
                            value={(selectedTask.predecessors || []).join(', ')}
                            onChange={(event) => {
                              const predecessors = event.target.value
                                .split(',')
                                .map(item => item.trim())
                                .filter(Boolean);
                              setTasks(prev =>
                                prev.map(task =>
                                  task.id === selectedTask.id
                                    ? { ...task, predecessors }
                                    : task
                                )
                              );
                            }}
                          />
                          <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        
                        {hasPredecessorConflicts && (
                          <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 animate-fade-in">
                            <div className="flex items-start gap-2 text-rose-700 mb-2">
                               <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                               <span className="text-xs font-semibold">Schedule Conflict Detected</span>
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
                                const duration = Math.max(day, currentEnd - currentStart);
                                const nextStart = maxEnd;
                                const nextEnd = Math.max(nextStart + day, nextStart + duration);
                                setTasks(prev =>
                                  prev.map(task =>
                                    task.id === selectedTask.id
                                      ? { ...task, startDate: nextStart, dueDate: nextEnd }
                                      : task
                                  )
                                );
                              }}
                              className="w-full rounded-md bg-white border border-rose-200 py-1.5 text-xs font-bold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors"
                            >
                              Fix Schedule (Shift Task)
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
                              setTasks(prev =>
                                prev.map(task =>
                                  task.id === selectedTask.id
                                    ? { ...task, isMilestone }
                                    : task
                                )
                              );
                            }}
                          />
                          <span className="text-sm text-slate-700 font-medium">Mark as Milestone</span>
                        </label>
                      </div>

                    </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium">Select a task on the chart<br/>to view details</p>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
        
      </div>
    </div>
  );
}
