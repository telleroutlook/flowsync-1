import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback, memo } from 'react';
import { ProjectSidebar } from './components/ProjectSidebar';
import { WorkspacePanel } from './components/WorkspacePanel';
import { Button } from './components/ui/Button';
import { cn } from './src/utils/cn';
import { Menu, X, Grid, List as ListIcon, Calendar, Upload, Download, History, MessageSquare, FileText, Check, MoreVertical } from 'lucide-react';
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true" />
      <p className="text-sm text-secondary font-medium">{message}</p>
    </div>
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

const formatAttachmentSize = (value: number): string => {
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const CHAT_EXPORT_SEPARATOR = '-'.repeat(72);

function App() {
  const { t, locale } = useI18n();

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

  const handleExportChat = useCallback(() => {
    const exportDate = new Date();
    const fileStamp = exportDate.toISOString().slice(0, 10);
    const baseName = `ai-chat-history-${fileStamp}`;

    // Memoize formatter outside callback to avoid recreation
    const formatTimestamp = (value: number) => {
      const date = new Date(value);
      return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    const roleLabel = (role: ChatMessage['role']) => {
      if (role === 'user') return t('export.chat.role.user');
      if (role === 'model') return t('export.chat.role.model');
      return t('export.chat.role.system');
    };

    const contentBlocks = messages.map((message, index) => {
      const trimmedText = message.text.trim();
      const lines: string[] = [
        CHAT_EXPORT_SEPARATOR,
        `${t('export.chat.message_label', { index: index + 1 })} | ${roleLabel(message.role)} | ${formatTimestamp(message.timestamp)}`,
        `${t('export.chat.content_label')}:`,
        trimmedText || t('export.chat.empty_message'),
      ];

      const attachments = message.attachments || [];
      if (attachments.length > 0) {
        lines.push('');
        lines.push(`${t('export.chat.attachments_label')}:`);
        attachments.forEach(attachment => {
          const typeLabel = attachment.type?.trim() || t('export.chat.attachment_unknown_type');
          lines.push(`- ${attachment.name} (${formatAttachmentSize(attachment.size)}, ${typeLabel})`);
        });
      }

      return lines.join('\n');
    });

    const output = [
      t('export.chat.title'),
      t('export.chat.exported_at', { date: formatTimestamp(exportDate.getTime()) }),
      t('export.chat.total_messages', { count: messages.length }),
      '',
      ...contentBlocks,
      '',
    ].join('\n');

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [locale, messages, t]);

  // 3. Audit Logs
  const { 
    auditLogs, auditTotal, isAuditLoading, auditError,
    auditPage, setAuditPage, auditPageSize, setAuditPageSize, auditFilters, setAuditFilters,
    refreshAuditLogs
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
    activeProject,
    activeTasks,
    refreshData,
    submitDraft,
    fetchAllTasks
  });

  // --- EFFECTS & HANDLERS ---

  // Handle selected task validation
  useEffect(() => {
    if (selectedTaskId && !tasks.find(task => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  // Handle outside click for export menu - optimized to prevent memory leaks
  useEffect(() => {
    if (!isExportOpen) return;
    const handleWindowClick = () => setIsExportOpen(false);
    const options = { capture: true } as const;
    window.addEventListener('click', handleWindowClick, options);
    return () => window.removeEventListener('click', handleWindowClick, options);
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

  // Derived State - memoized to prevent recreation on every render
  const viewLabels: Record<ViewMode, string> = useMemo(() => ({
    BOARD: t('app.view.board'),
    LIST: t('app.view.list'),
    GANTT: t('app.view.gantt'),
  }), [t]);

  return (
    <div className="flex h-screen h-[100dvh] w-full bg-background overflow-hidden text-text-primary font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* 1. Project Sidebar (Left) */}
      <div className={cn(
        "transition-all duration-300 overflow-hidden bg-surface relative z-20 flex-shrink-0",
        isSidebarOpen ? "w-[260px] border-r border-border-subtle" : "w-0 border-none"
      )}>
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
        <div className="h-14 border-b border-border-subtle flex items-center justify-between px-4 bg-surface/80 backdrop-blur-md z-20 sticky top-0 shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(prev => !prev)}
              title={isSidebarOpen ? t('app.sidebar.close') : t('app.sidebar.open')}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-text-primary leading-tight truncate max-w-[200px]">{activeProject.name}</h2>
              {activeProject.description && (
                 <p className="text-[10px] font-medium text-text-secondary truncate max-w-[200px]">{activeProject.description}</p>
              )}
            </div>
            
            <div className="h-5 w-px bg-border-subtle mx-2"></div>

            {/* View Switcher */}
            <div className="flex p-1 bg-background/50 rounded-lg border border-border-subtle gap-1">
               <Button
                 variant={viewMode === 'BOARD' ? 'secondary' : 'ghost'}
                 size="sm"
                 onClick={() => setViewMode('BOARD')}
                 className="h-7 px-2 text-xs"
               >
                 <Grid className="w-3.5 h-3.5 mr-1.5" />
                 {t('app.view.board')}
               </Button>
               <Button
                 variant={viewMode === 'LIST' ? 'secondary' : 'ghost'}
                 size="sm"
                 onClick={() => setViewMode('LIST')}
                 className="h-7 px-2 text-xs"
               >
                 <ListIcon className="w-3.5 h-3.5 mr-1.5" />
                 {t('app.view.list')}
               </Button>
               <Button
                 variant={viewMode === 'GANTT' ? 'secondary' : 'ghost'}
                 size="sm"
                 onClick={() => setViewMode('GANTT')}
                 className="h-7 px-2 text-xs"
               >
                 <Calendar className="w-3.5 h-3.5 mr-1.5" />
                 {t('app.view.gantt')}
               </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
             {/* Import Group */}
             <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border-subtle shadow-sm">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                className="h-7 px-2 text-xs"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {t('app.header.import')}
              </Button>
              <div className="w-px h-3 bg-border-subtle"></div>
              <select
                value={importStrategy}
                onChange={(event) => {
                  const value = event.target.value;
                  recordImportPreference(value === 'merge' ? 'merge' : 'append');
                }}
                className="bg-transparent text-xs font-medium text-text-secondary outline-none cursor-pointer hover:text-primary border-none py-0 focus:ring-0 h-7"
                aria-label={t('app.header.import_strategy')}
              >
                <option value="append">{t('app.header.import.append')}</option>
                <option value="merge">{t('app.header.import.merge')}</option>
              </select>
             </div>

             {/* Audit Button */}
             <div className="relative">
              <Button
                variant={isAuditOpen ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIsAuditOpen(prev => !prev)}
                className="h-9 px-3 gap-2"
                aria-label={`${t('app.header.audit')} (${auditLogs.length})`}
              >
                <History className="w-4 h-4" />
                <span>{t('app.header.audit')}</span>
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary min-w-[18px] text-center">
                  {auditLogs.length}
                </span>
              </Button>
            </div>

            {/* Export Button */}
            <div className="relative">
              <Button
                 variant="outline"
                 size="sm"
                 onClick={(event) => {
                  event.stopPropagation();
                  setIsExportOpen(prev => !prev);
                 }}
                 className="h-9 px-3 gap-2"
               >
                 <span>{t('app.header.export')}</span>
                 <Download className="w-4 h-4" />
               </Button>
               {isExportOpen && (
                 <div
                   onClick={(event) => event.stopPropagation()}
                   className="absolute right-0 mt-2 w-64 rounded-xl border border-border-subtle bg-surface shadow-xl z-50 p-2 animate-fade-in"
                   role="menu"
                 >
                   <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary/50">{t('app.header.export_scope')}</div>
                   <div className="flex gap-1 p-1 bg-background rounded-lg mb-2">
                     <Button
                       variant={exportScope === 'active' ? 'secondary' : 'ghost'}
                       size="sm"
                       onClick={() => setExportScope('active')}
                       className="flex-1 h-7 text-xs"
                       role="menuitemradio"
                       aria-checked={exportScope === 'active'}
                     >
                       {t('app.header.export_current')}
                     </Button>
                     <Button
                       variant={exportScope === 'all' ? 'secondary' : 'ghost'}
                       size="sm"
                       onClick={() => setExportScope('all')}
                       className="flex-1 h-7 text-xs"
                     >
                       {t('app.header.export_all')}
                     </Button>
                   </div>
                   
                   <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary/50">{t('app.header.format')}</div>
                   <div className="grid grid-cols-1 gap-1">
                     {([
                       { id: 'csv', label: 'CSV', desc: t('export.format.csv_desc'), icon: FileText },
                       { id: 'pdf', label: 'PDF', desc: t('export.format.pdf_desc'), icon: FileText },
                       { id: 'json', label: 'JSON', desc: t('export.format.json_desc'), icon: FileText },
                       { id: 'markdown', label: 'Markdown', desc: t('export.format.markdown_desc'), icon: FileText },
                     ] as const).map(item => (
                       <button
                         key={item.id}
                         type="button"
                         onClick={() => {
                           void handleExportTasks(item.id, exportScope);
                           setIsExportOpen(false);
                         }}
                         className={cn(
                           "group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors",
                           lastExportFormat === item.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-background' 
                         )}
                       >
                         <div className="flex items-center gap-3">
                            <item.icon className="w-4 h-4 opacity-70" />
                            <div className="flex flex-col items-start">
                              <span className="font-semibold">{item.label}</span>
                              <span className="text-[9px] opacity-70 group-hover:opacity-100">{item.desc}</span>
                            </div>
                         </div>
                         {lastExportFormat === item.id && <Check className="w-3 h-3 text-primary" />}
                       </button>
                     ))}
                   </div>

                   <div className="mt-2 border-t border-border-subtle pt-2">
                     <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary/50">{t('app.header.export_chat')}</div>
                     <button
                       type="button"
                       onClick={() => {
                         handleExportChat();
                         setIsExportOpen(false);
                       }}
                       className="w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-text-secondary hover:bg-background"
                     >
                       <div className="flex items-center gap-3">
                         <MessageSquare className="w-4 h-4 opacity-70" />
                         <div className="flex flex-col items-start">
                           <span className="font-semibold">TXT</span>
                           <span className="text-[9px] opacity-70 group-hover:opacity-100">{t('export.format.chat_txt_desc')}</span>
                         </div>
                       </div>
                     </button>
                   </div>
                 </div>
               )}
             </div>

             <Button 
                variant={isChatOpen ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setIsChatOpen(prev => !prev)}
                title={t('app.header.toggle_chat')}
             >
                <MessageSquare className="w-5 h-5" />
             </Button>
          </div>
        </div>

        {dataError && (
          <div className="px-6 py-3 text-sm font-medium bg-negative/5 text-negative border-b border-negative/20" role="alert">
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
                    <div className="flex-1 h-full min-w-0 bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden">
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

              <div className={cn(
                "transition-all duration-300",
                selectedTask ? "w-[350px] opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-10 pointer-events-none"
              )}>
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
