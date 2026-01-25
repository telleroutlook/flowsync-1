import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback, memo } from 'react';
import { ProjectSidebar } from './components/ProjectSidebar';
import { WorkspacePanel } from './components/WorkspacePanel';
import { LoginModal } from './components/LoginModal';
import WorkspaceModal from './components/WorkspaceModal';
import { UserProfileModal } from './components/UserProfileModal';
import { ChatInterface } from './components/ChatInterface';
import { AuditPanel } from './components/AuditPanel';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { CreateProjectModal } from './components/CreateProjectModal';
import { Task, DraftAction, ChatMessage } from './types';
import { useProjectData } from './src/hooks/useProjectData';
import { useAuth } from './src/hooks/useAuth';
import { useWorkspaces } from './src/hooks/useWorkspaces';
import { useDrafts } from './src/hooks/useDrafts';
import { useAuditLogs } from './src/hooks/useAuditLogs';
import { useChat } from './src/hooks/useChat';
import { useExport } from './src/hooks/useExport';
import { generateId } from './src/utils';
import { useI18n } from './src/i18n';

// Lazy Load View Components
const KanbanBoard = React.lazy(() => import('./components/KanbanBoard').then(module => ({ default: module.KanbanBoard })));
const ListView = React.lazy(() => import('./components/ListView').then(module => ({ default: module.ListView })));
const GanttChart = React.lazy(() => import('./components/GanttChart').then(module => ({ default: module.GanttChart })));

type ViewMode = 'BOARD' | 'LIST' | 'GANTT';

// Memoized loading spinner component
const LoadingSpinner = memo(({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" aria-hidden="true" />
      <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

function App() {
  const { t } = useI18n();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('GANTT'); 
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Refs
  const importInputRef = useRef<HTMLInputElement>(null);
  const pendingTaskUpdatesRef = useRef<Record<string, Partial<Task>>>({});
  const taskUpdateTimers = useRef<Map<string, number>>(new Map());

  // --- HOOKS ---

  // 1. Auth & Workspaces
  const { user, error: authError, login, register, logout } = useAuth();
  const {
    workspaces,
    accessibleWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    pendingRequests,
    members,
    createWorkspace,
    requestJoin,
    approveRequest,
    rejectRequest,
    removeMember,
  } = useWorkspaces(user);

  // 2. Data
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
  } = useProjectData(activeWorkspaceId);

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
        } catch {
          localStorage.removeItem('flowsync_chat_history');
        }
      }
    }
    return [{
      id: 'welcome',
      role: 'model',
      text: t('chat.welcome'),
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
      text: t('chat.welcome'),
      timestamp: Date.now(),
    };
    setMessages([initialMsg]);
    localStorage.removeItem('flowsync_chat_history');
  }, [t]);

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
    handleAttachFiles, handleRemoveAttachment, handleSendMessage, processingSteps, thinkingPreview,
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
  const viewLabels: Record<ViewMode, string> = {
    BOARD: t('app.view.board'),
    LIST: t('app.view.list'),
    GANTT: t('app.view.gantt'),
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-text-primary font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* 1. Project Sidebar (Left) */}
      <div className={`${isSidebarOpen ? 'w-[260px]' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border-subtle bg-surface relative z-20 flex-shrink-0`}>
        <ProjectSidebar 
          topSlot={(
            <WorkspacePanel
              user={user}
              workspaces={accessibleWorkspaces}
              activeWorkspaceId={activeWorkspaceId}
              onSelectWorkspace={setActiveWorkspaceId}
              onOpenLogin={() => setIsLoginOpen(true)}
              onLogout={logout}
              onOpenManage={() => setIsWorkspaceOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
            />
          )}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onCreateProject={manualCreateProject}
          onDeleteProject={handleDeleteProject}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* 2. Workspace (Middle) */}
      <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-border-subtle flex items-center justify-between px-4 bg-surface/80 backdrop-blur-md z-20 sticky top-0 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg transition-colors"
              title={isSidebarOpen ? t('app.sidebar.close') : t('app.sidebar.open')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex flex-col">
              <h2 className="text-base font-bold text-text-primary leading-tight truncate max-w-[200px]">{activeProject.name}</h2>
              {activeProject.description && (
                 <p className="text-xs font-medium text-text-secondary truncate max-w-[200px]">{activeProject.description}</p>
              )}
            </div>
            
            <div className="h-4 w-px bg-border-subtle mx-2"></div>

            {/* View Switcher */}
            <div className="flex p-0.5 bg-background rounded-lg border border-border-subtle backdrop-blur-sm">
               {['BOARD', 'LIST', 'GANTT'].map((mode) => (
                 <button
                   key={mode}
                   onClick={() => setViewMode(mode as ViewMode)}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all ${
                     viewMode === mode
                       ? 'bg-surface text-primary shadow-sm ring-1 ring-black/5'
                       : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
                   }`}
                   aria-label={`${viewLabels[mode as ViewMode]} view`}
                   aria-pressed={viewMode === mode}
                 >
                   {viewLabels[mode as ViewMode]}
                 </button>
               ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1.5 bg-surface p-0.5 rounded-lg border border-border-subtle shadow-sm">
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
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-background hover:text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span>{t('app.header.import')}</span>
              </button>
              <div className="w-px h-3 bg-border-subtle"></div>
              <select
                value={importStrategy}
                onChange={(event) => {
                  const value = event.target.value;
                  recordImportPreference(value === 'merge' ? 'merge' : 'append');
                }}
                className="bg-transparent text-xs font-medium text-text-secondary outline-none cursor-pointer hover:text-primary border-none py-0 focus:ring-0"
                aria-label={t('app.header.import_strategy')}
              >
                <option value="append">{t('app.header.import.append')}</option>
                <option value="merge">{t('app.header.import.merge')}</option>
              </select>
             </div>

             <div className="relative">
              <button
                type="button"
                onClick={() => setIsAuditOpen(prev => !prev)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                  isAuditOpen
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-border-subtle bg-surface text-text-secondary hover:border-primary/30 hover:text-primary'
                }`}
                aria-label={`${t('app.header.audit')} (${auditLogs.length})`}
              >
                <span>{t('app.header.audit')}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary min-w-[18px] text-center">
                  {auditLogs.length}
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
                 className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-secondary shadow-sm hover:border-primary/30 hover:text-primary transition-all"
                 aria-label={t('app.header.export')}
               >
                 <span>{t('app.header.export')}</span>
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </button>
               {isExportOpen && (
                 <div
                   onClick={(event) => event.stopPropagation()}
                   className="absolute right-0 mt-2 w-64 rounded-xl border border-border-subtle bg-surface shadow-xl shadow-black/5 z-50 p-2 animate-fade-in"
                   role="menu"
                 >
                   <div className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-widest text-text-secondary/50">{t('app.header.export_scope')}</div>
                   <div className="flex gap-1 p-1 bg-background rounded-lg mb-2">
                     <button
                       type="button"
                       onClick={() => setExportScope('active')}
                       className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-all ${
                         exportScope === 'active'
                           ? 'bg-surface text-primary shadow-sm ring-1 ring-black/5'
                           : 'text-text-secondary hover:text-text-primary'
                       }`}
                       role="menuitemradio"
                       aria-checked={exportScope === 'active'}
                     >
                       {t('app.header.export_current')}
                     </button>
                     <button
                       type="button"
                       onClick={() => setExportScope('all')}
                       className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-all ${ 
                         exportScope === 'all'
                           ? 'bg-surface text-primary shadow-sm ring-1 ring-black/5'
                           : 'text-text-secondary hover:text-text-primary'
                       }`}
                     >
                       {t('app.header.export_all')}
                     </button>
                   </div>
                   
                   <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary/50">{t('app.header.format')}</div>
                   <div className="grid grid-cols-1 gap-0.5">
                     {([
                       { id: 'csv', label: 'CSV', desc: t('export.format.csv_desc') },
                       { id: 'pdf', label: 'PDF', desc: t('export.format.pdf_desc') },
                       { id: 'json', label: 'JSON', desc: t('export.format.json_desc') },
                       { id: 'markdown', label: 'Markdown', desc: t('export.format.markdown_desc') },
                     ] as const).map(item => (
                       <button
                         key={item.id}
                         type="button"
                         onClick={() => {
                           void handleExportTasks(item.id, exportScope);
                           setIsExportOpen(false);
                         }}
                         className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${ 
                           lastExportFormat === item.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-background' 
                         }`}
                       >
                         <div className="flex flex-col items-start">
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-[9px] opacity-70 group-hover:opacity-100">{item.desc}</span>
                         </div>
                         {lastExportFormat === item.id && <span className="text-primary">✓</span>}
                       </button>
                     ))}
                   </div>
                 </div>
               )}
             </div>

             <button 
                onClick={() => setIsChatOpen(prev => !prev)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isChatOpen 
                    ? 'text-primary bg-primary/10' 
                    : 'text-text-secondary hover:text-primary hover:bg-background'
                }`}
                title={t('app.header.toggle_chat')}
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
             </button>
          </div>
        </div>

        {dataError && (
          <div className="px-6 py-3 text-sm font-medium bg-rose-50 text-rose-700 border-b border-slate-200" role="alert">
            {t('app.error.load_data', { error: dataError })}
          </div>
        )}

        <AuditPanel
          isOpen={isAuditOpen}
          isLoading={isAuditLoading}
          onRefresh={() => refreshAuditLogs(activeProjectId)}
          filters={auditFilters}
          setFilters={setAuditFilters}
          logs={auditLogs}
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

        <LoginModal
          isOpen={isLoginOpen}
          error={authError}
          onClose={() => setIsLoginOpen(false)}
          onLogin={login}
          onRegister={register}
        />

        <WorkspaceModal
          isOpen={isWorkspaceOpen}
          onClose={() => setIsWorkspaceOpen(false)}
          workspaces={workspaces}
          pendingRequests={pendingRequests}
          members={members}
          activeWorkspaceId={activeWorkspaceId}
          onCreate={createWorkspace}
          onRequestJoin={requestJoin}
          onApprove={approveRequest}
          onReject={rejectRequest}
          onRemoveMember={removeMember}
        />

        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={user}
        />

        {/* View Area */}
        <div className="p-4 flex-1 overflow-hidden relative z-10 custom-scrollbar flex gap-4">
          {isLoadingData ? (
            <LoadingSpinner message={t('app.loading.project_data')} />
          ) : (
            <>
              <div className="flex-1 min-w-0 h-full overflow-hidden relative">
                <Suspense fallback={<LoadingSpinner message={t('app.loading.view')} />}>
                  {viewMode === 'BOARD' && (
                    <KanbanBoard
                      tasks={activeTasks}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={(id) => setSelectedTaskId(id)}
                    />
                  )}
                  {viewMode === 'LIST' && (
                    <ListView
                      tasks={activeTasks}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={(id) => setSelectedTaskId(id)}
                    />
                  )}
                  {viewMode === 'GANTT' && (
                    <div className="flex-1 h-full min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <GanttChart
                        tasks={activeTasks}
                        selectedTaskId={selectedTaskId}
                        onSelectTask={(id) => setSelectedTaskId(id)}
                        onUpdateTaskDates={(id, startDate, dueDate) => {
                          queueTaskUpdate(id, { startDate, dueDate });
                        }}
                      />
                    </div>
                  )}
                </Suspense>
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
            </>
          )}
        </div>
        
      </div>

      {/* 3. Chat Interface (Right) */}
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
        processingSteps={processingSteps}
        thinkingPreview={thinkingPreview}
        messagesEndRef={messagesEndRef}
        onSendMessage={handleSendMessage}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={handleRemoveAttachment}
        fileInputRef={fileInputRef}
        onAttachFiles={handleAttachFiles}
        inputText={inputText}
        setInputText={setInputText}
      />
    </div>
  );
}

export default memo(App);
