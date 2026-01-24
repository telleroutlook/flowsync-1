import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback } from 'react';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ChatInterface } from './components/ChatInterface';
import { AuditPanel } from './components/AuditPanel';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { CreateProjectModal } from './components/CreateProjectModal';
import { Task, DraftAction, ChatMessage, TaskStatus, Priority } from './types';
import { useProjectData } from './src/hooks/useProjectData';
import { useDrafts } from './src/hooks/useDrafts';
import { useAuditLogs } from './src/hooks/useAuditLogs';
import { useChat } from './src/hooks/useChat';
import { useExport } from './src/hooks/useExport';

// Lazy Load View Components
const KanbanBoard = React.lazy(() => import('./components/KanbanBoard').then(module => ({ default: module.KanbanBoard })));
const ListView = React.lazy(() => import('./components/ListView').then(module => ({ default: module.ListView })));
const GanttChart = React.lazy(() => import('./components/GanttChart').then(module => ({ default: module.GanttChart })));

// Simple ID generator
const generateId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

type ViewMode = 'BOARD' | 'LIST' | 'GANTT';

export default function App() {
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('GANTT'); 
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  
  // Refs
  const importInputRef = useRef<HTMLInputElement>(null);
  const pendingTaskUpdatesRef = useRef<Record<string, Partial<Task>>>({});
  const taskUpdateTimers = useRef<Map<string, number>>(new Map());

  // --- HOOKS ---

  // 1. Data
  const { 
    projects, 
    tasks, 
    setTasks, 
    activeProjectId, 
    activeProject, 
    activeTasks, 
    isLoading: isLoadingData, 
    error: dataError,
    refreshData, 
    handleSelectProject,
    fetchAllTasks
  } = useProjectData();

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find(task => task.id === selectedTaskId) ?? null : null),
    [tasks, selectedTaskId]
  );

  // 2. Chat State (Lifted)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flowsync_chat_history');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse chat history", e);
        }
      }
    }
    return [{
      id: 'welcome',
      role: 'model',
      text: "Hello! I'm FlowSync. I've loaded your Construction Project WBS. I can help manage schedules, WBS codes, and assignees.",
      timestamp: Date.now(),
    }];
  });

  // Persist chat messages
  useEffect(() => {
    localStorage.setItem('flowsync_chat_history', JSON.stringify(messages));
  }, [messages]);

  const appendSystemMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'system',
      text,
      timestamp: Date.now(),
    }]);
  }, []);

  const handleResetChat = useCallback(() => {
    const initialMsg: ChatMessage = {
      id: 'welcome',
      role: 'model',
      text: "Hello! I'm FlowSync. I've loaded your Construction Project WBS. I can help manage schedules, WBS codes, and assignees.",
      timestamp: Date.now(),
    };
    setMessages([initialMsg]);
    localStorage.removeItem('flowsync_chat_history');
  }, []);

  // 3. Audit Logs
  const { 
    auditLogs, auditTotal, isAuditLoading, auditError, rollbackingAuditId,
    auditPage, setAuditPage, auditPageSize, setAuditPageSize, auditFilters, setAuditFilters,
    refreshAuditLogs, handleRollbackAudit
  } = useAuditLogs({ 
    activeProjectId, 
    refreshData,
    appendSystemMessage 
  });

  // 4. Drafts
  const {
    drafts, pendingDraft, pendingDraftId, setPendingDraftId, draftWarnings,
    refreshDrafts, submitDraft, handleApplyDraft, handleDiscardDraft
  } = useDrafts({ 
    activeProjectId, 
    refreshData, 
    refreshAuditLogs, 
    appendSystemMessage 
  });

  // 5. Chat Logic
  const {
    inputText, setInputText, isProcessing, pendingAttachments,
    handleAttachFiles, handleRemoveAttachment, handleSendMessage,
    messagesEndRef, fileInputRef
  } = useChat({
    activeProjectId,
    activeProject,
    activeTasks,
    selectedTask: selectedTask || null,
    projects,
    refreshData,
    submitDraft,
    handleApplyDraft,
    appendSystemMessage,
    messages,
    setMessages
  });

  // 6. Export/Import
  const {
    isExportOpen, setIsExportOpen, exportScope, setExportScope,
    lastExportFormat, importStrategy, recordImportPreference,
    handleExportTasks, handleImportFile
  } = useExport({
    projects,
    tasks,
    activeProject,
    activeTasks,
    refreshData,
    submitDraft,
    fetchAllTasks
  });

  // --- EFFECTS & HANDLERS ---

  // Sync scroll on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messagesEndRef]);

  // Handle selected task validation
  useEffect(() => {
    if (selectedTaskId && !tasks.find(task => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  // Handle outside click for export menu
  useEffect(() => {
    if (!isExportOpen) return;
    const handleWindowClick = () => setIsExportOpen(false);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isExportOpen]);

  // Manual Project Actions
  const manualCreateProject = useCallback(() => {
    setIsCreateProjectOpen(true);
  }, []);

  const handleCreateProject = useCallback(async (name: string, description: string) => {
    await submitDraft(
      [
        {
          id: generateId(),
          entityType: 'project',
          action: 'create',
          after: { name, description },
        },
      ],
      { createdBy: 'user', autoApply: true, reason: 'Manual project create' }
    );
  }, [submitDraft]);

  const handleDeleteProject = useCallback(async (id: string) => {
    await submitDraft(
      [
        {
          id: generateId(),
          entityType: 'project',
          action: 'delete',
          entityId: id,
        },
      ],
      { createdBy: 'user', autoApply: true, reason: 'Manual project delete' }
    );
  }, [submitDraft]);

  // Optimistic Task Updates with Debounce
  const queueTaskUpdate = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? { ...task, ...updates }
          : task
      )
    );

    pendingTaskUpdatesRef.current[id] = {
      ...(pendingTaskUpdatesRef.current[id] || {}),
      ...updates,
    };

    const existing = taskUpdateTimers.current.get(id);
    if (existing) window.clearTimeout(existing);

    const timer = window.setTimeout(async () => {
      const payload = pendingTaskUpdatesRef.current[id];
      if (!payload) return;
      delete pendingTaskUpdatesRef.current[id];
      taskUpdateTimers.current.delete(id);
      await submitDraft(
        [
          {
            id: generateId(),
            entityType: 'task',
            action: 'update',
            entityId: id,
            after: payload,
          },
        ],
        { createdBy: 'user', autoApply: true, reason: 'Inline task update', silent: true }
      );
    }, 600);

    taskUpdateTimers.current.set(id, timer);
  }, [setTasks, submitDraft]);

  // Derived State
  const filteredAuditLogs = useMemo(() => auditLogs, [auditLogs]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. Chat Interface (Left) */}
      <ChatInterface
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        onResetChat={handleResetChat}
        pendingDraft={pendingDraft}
        draftWarnings={draftWarnings}
        onApplyDraft={handleApplyDraft}
        onDiscardDraft={handleDiscardDraft}
        messages={messages}
        isProcessing={isProcessing}
        messagesEndRef={messagesEndRef}
        onSendMessage={handleSendMessage}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={handleRemoveAttachment}
        fileInputRef={fileInputRef}
        onAttachFiles={handleAttachFiles}
        inputText={inputText}
        setInputText={setInputText}
      />

      {/* 2. Project Sidebar (Middle-Left) */}
      <ProjectSidebar 
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onCreateProject={manualCreateProject}
        onDeleteProject={handleDeleteProject}
        showChatToggle={!isChatOpen}
        onToggleChat={() => setIsChatOpen(true)}
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
                onChange={(event) => recordImportPreference(event.target.value as any)}
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
                onClick={() => setIsAuditOpen(prev => !prev)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-all ${ 
                  isAuditOpen
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                <span>Audit</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {filteredAuditLogs.length}
                </span>
              </button>
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
                       { id: 'pdf', label: 'PDF', desc: 'Document view' },
                       { id: 'json', label: 'JSON', desc: 'Raw data' },
                       { id: 'markdown', label: 'Markdown', desc: 'Documentation' },
                     ] as const).map(item => (
                       <button
                         key={item.id}
                         type="button"
                         onClick={() => {
                           void handleExportTasks(item.id, exportScope);
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

        {dataError && (
          <div className="px-6 py-3 text-xs font-medium bg-rose-50 text-rose-700 border-b border-slate-200">
            Failed to load data: {dataError}
          </div>
        )}

        <AuditPanel
          isOpen={isAuditOpen}
          isLoading={isAuditLoading}
          onRefresh={() => refreshAuditLogs(activeProjectId)}
          filters={auditFilters}
          setFilters={setAuditFilters}
          logs={filteredAuditLogs}
          total={auditTotal}
          page={auditPage}
          setPage={setAuditPage}
          pageSize={auditPageSize}
          setPageSize={setAuditPageSize}
          onRollback={handleRollbackAudit}
          rollbackingId={rollbackingAuditId}
          error={auditError}
        />

        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
          onCreate={handleCreateProject}
        />

        {/* View Area */}
        <div className="p-6 flex-1 overflow-hidden relative z-10">
          {isLoadingData ? (
             <div className="flex items-center justify-center h-full">
               <div className="flex flex-col items-center gap-3">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                 <p className="text-xs text-slate-500 font-medium">Loading Project Data...</p>
               </div>
            </div>
          ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
               <div className="flex flex-col items-center gap-3">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                 <p className="text-xs text-slate-500 font-medium">Loading View...</p>
               </div>
            </div>
          }>
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
                      queueTaskUpdate(id, { startDate, dueDate });
                    }}
                  />
                </div>
                <div className={`transition-all duration-300 ${selectedTask ? 'w-[300px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 pointer-events-none'}`}>
                   {selectedTask && (
                     <TaskDetailPanel 
                       selectedTask={selectedTask}
                       onClose={() => setSelectedTaskId(null)}
                       onUpdate={queueTaskUpdate}
                       tasks={tasks}
                     />
                   )}
                </div>
              </div>
            )}
          </Suspense>
          )}
        </div>
        
      </div>
    </div>
  );
}