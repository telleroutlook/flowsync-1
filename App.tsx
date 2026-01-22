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
            {pendingAttachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pendingAttachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                  >
                    <span className="max-w-[140px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
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
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700"
                disabled={isProcessing}
                aria-label="Attach files"
              >
                <span aria-hidden>📎</span>
              </button>
              <div className="relative flex-1">
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
                  disabled={(inputText.trim().length === 0 && pendingAttachments.length === 0) || isProcessing}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
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
             <div className="relative">
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
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              >
                <span>Import</span>
              </button>
              <select
                value={importStrategy}
                onChange={(event) => recordImportPreference(event.target.value as ImportStrategy)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-semibold text-slate-600"
                aria-label="Import strategy"
              >
                <option value="append">Append</option>
                <option value="merge">Merge by ID</option>
              </select>
               <button
                 type="button"
                 onClick={(event) => {
                   event.stopPropagation();
                   setIsExportOpen(prev => !prev);
                 }}
                 className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-white"
               >
                 <span>Export</span>
                 <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                   <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                 </svg>
               </button>
               {isExportOpen && (
                 <div
                   onClick={(event) => event.stopPropagation()}
                   className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg"
                 >
                   <div className="px-3 pt-3 text-[10px] uppercase tracking-widest text-slate-400">Scope</div>
                   <div className="px-3 pb-2">
                     <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                       <button
                         type="button"
                         onClick={() => setExportScope('active')}
                         className={`flex-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                           exportScope === 'active'
                             ? 'bg-white text-slate-800 shadow-sm'
                             : 'text-slate-500'
                         }`}
                       >
                         Active
                       </button>
                       <button
                         type="button"
                         onClick={() => setExportScope('all')}
                         className={`flex-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                           exportScope === 'all'
                             ? 'bg-white text-slate-800 shadow-sm'
                             : 'text-slate-500'
                         }`}
                       >
                         All projects
                       </button>
                     </div>
                   </div>
                   <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-400">
                     Export format
                   </div>
                   {([
                     { id: 'csv', label: 'CSV (.csv)' },
                     { id: 'tsv', label: 'TSV (.tsv)' },
                     { id: 'xlsx', label: 'Excel (.xlsx)' },
                     { id: 'pdf', label: 'PDF (.pdf)' },
                     { id: 'json', label: 'JSON (.json)' },
                     { id: 'markdown', label: 'Markdown (.md)' },
                   ] as const).map(item => (
                     <button
                       key={item.id}
                       type="button"
                       onClick={() => {
                         void exportTasks(item.id, exportScope);
                         setIsExportOpen(false);
                       }}
                       className={`flex w-full items-center justify-between px-3 py-2 text-xs ${
                         lastExportFormat === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                       }`}
                     >
                       <span>{item.label}</span>
                       <span className="text-[10px] text-slate-400">
                         {lastExportFormat === item.id ? 'default' : (exportScope === 'all' ? 'all' : 'active')}
                       </span>
                     </button>
                   ))}
                 </div>
               )}
             </div>
             <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-700 font-bold text-xs">AI</div>
             </div>
          </div>
        </div>

        {/* View Area */}
        <div className="p-6 flex-1 overflow-hidden relative z-10">
            {viewMode === 'BOARD' && <KanbanBoard tasks={activeTasks} />}
            {viewMode === 'LIST' && <ListView tasks={activeTasks} />}
            {viewMode === 'GANTT' && (
              <div className="flex h-full gap-4">
                <div className="flex-1 min-w-0">
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
                <div className="w-[260px] bg-white border border-slate-200 rounded-xl shadow-sm p-4 overflow-y-auto">
                  {selectedTask ? (
                    <div className="space-y-3 text-xs text-slate-600">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Task</div>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
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

                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Assignee</div>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
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

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Status</div>
                          <select
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
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
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Priority</div>
                          <select
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
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

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
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
                          <span>Milestone</span>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">WBS</div>
                          <input
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
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

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Start</div>
                          <input
                            type="date"
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
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
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Due</div>
                          <input
                            type="date"
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
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

                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Predecessors</div>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                          placeholder="e.g. t1,t2 or 1.1,2.0"
                          value={(selectedTask.predecessors || []).join(',')}
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
                        {hasPredecessorConflicts && (
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
                            className="mt-2 w-full rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                          >
                            Auto-shift to resolve conflicts
                          </button>
                        )}
                        {predecessorDetails.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {predecessorDetails.map(({ ref, task, conflict }) => (
                              <button
                                key={ref}
                                type="button"
                                onClick={() => task && setSelectedTaskId(task.id)}
                                className={`flex w-full items-center justify-between rounded-lg border px-2 py-1 text-[10px] ${
                                  conflict
                                    ? 'border-rose-200 bg-rose-50 text-rose-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                } ${task ? 'hover:border-indigo-200 hover:bg-indigo-50' : ''}`}
                              >
                                <span className="truncate">
                                  {task ? task.title : `Missing: ${ref}`}
                                </span>
                                {conflict && <span className="font-semibold">Conflict</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Completion</div>
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
                          className="w-full"
                        />
                        <div className="text-[10px] text-slate-400 mt-1">{selectedTask.completion ?? 0}%</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Select a task to edit details.</div>
                  )}
                </div>
              </div>
            )}
        </div>
        
      </div>
    </div>
  );
}
