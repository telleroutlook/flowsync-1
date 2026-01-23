import React, { useState, useRef, useCallback } from 'react';
import { geminiService } from '../../services/geminiService';
import { apiService } from '../../services/apiService';
import { ChatMessage, ChatAttachment, DraftAction, Project, Task } from '../../types';

// Simple ID generator
const generateId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

interface UseChatProps {
  activeProjectId: string;
  activeProject: Project;
  activeTasks: Task[];
  projects: Project[];
  refreshData: () => Promise<void>;
  submitDraft: (actions: DraftAction[], options: { reason?: string; createdBy: string; autoApply?: boolean; silent?: boolean }) => Promise<any>;
  handleApplyDraft: (draftId: string) => Promise<void>;
  appendSystemMessage: (text: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const useChat = ({
  activeProjectId,
  activeProject,
  activeTasks,
  projects,
  refreshData,
  submitDraft,
  handleApplyDraft,
  appendSystemMessage,
  messages,
  setMessages
}: UseChatProps) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextAttachments = Array.from(files).map(file => ({
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    setPendingAttachments(prev => [...prev, ...nextAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => {
      const target = prev.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(item => item.id !== id);
    });
  }, []);

  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
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
      const systemContext = `Active Project: ${activeProject.name || 'None'}. 
                             Active Project ID: ${activeProject.id || 'N/A'}.
                             Available Projects: ${projects.map(p => `${p.name} (${p.id})`).join(', ')}.
                             ${ 
                               shouldIncludeFullMappings
                                 ? `Task IDs in Active Project (JSON): ${mappingJson}.` 
                                 : `Task IDs in Active Project (compact JSON): ${mappingJson}.`
                             }`;

      // Call Gemini Service
      const response = await geminiService.sendMessage(history, userMsg.text, systemContext);

      let finalText = response.text;
      const toolResults: string[] = [];
      const draftActions: DraftAction[] = [];
      let draftReason: string | undefined;

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          const args = (call.args || {}) as Record<string, unknown>;
          
          if (call.name === 'listProjects') {
            const list = await apiService.listProjects();
            toolResults.push(`Projects (${list.length}): ${list.map(p => `${p.name} (${p.id})`).join(', ')}`);
            continue;
          }
          if (call.name === 'getProject') {
            if (typeof args.id === 'string') {
              const project = await apiService.getProject(args.id);
              toolResults.push(`Project: ${project.name} (${project.id})`);
            }
            continue;
          }
          if (call.name === 'listTasks' || call.name === 'searchTasks') {
            const result = await apiService.listTasks({
              projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
              status: typeof args.status === 'string' ? args.status : undefined,
              assignee: typeof args.assignee === 'string' ? args.assignee : undefined,
              q: typeof args.q === 'string' ? args.q : undefined,
              page: typeof args.page === 'number' ? args.page : undefined,
              pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
            });
            const sample = result.data.slice(0, 5).map(task => task.title).join(', ');
            toolResults.push(`Tasks (${result.total}): ${sample}${result.total > 5 ? '…' : ''}`);
            continue;
          }
          if (call.name === 'getTask') {
            if (typeof args.id === 'string') {
              const task = await apiService.getTask(args.id);
              toolResults.push(`Task: ${task.title} (${task.id})`);
            }
            continue;
          }
          if (call.name === 'planChanges') {
            if (Array.isArray(args.actions)) {
              // Directly submit draft from planChanges
              const actions = (args.actions as DraftAction[]).map(action => ({
                id: action.id || generateId(),
                entityType: action.entityType,
                action: action.action,
                entityId: action.entityId,
                after: action.after,
              }));
              draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
              await submitDraft(actions, { createdBy: 'agent', autoApply: false, reason: draftReason });
            }
            continue;
          }
          if (call.name === 'applyChanges') {
            if (typeof args.draftId === 'string') {
              await handleApplyDraft(args.draftId);
              toolResults.push(`Applied draft ${args.draftId}.`);
            }
            continue;
          }
          // Legacy direct actions mapping to draftActions
          if (call.name === 'createProject') {
            draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
            draftActions.push({
              id: generateId(),
              entityType: 'project',
              action: 'create',
              after: {
                name: args.name,
                description: args.description,
                icon: args.icon,
              },
            });
            continue;
          }
          if (call.name === 'updateProject') {
            draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
            draftActions.push({
              id: generateId(),
              entityType: 'project',
              action: 'update',
              entityId: args.id as string | undefined,
              after: {
                name: args.name,
                description: args.description,
                icon: args.icon,
              },
            });
            continue;
          }
          if (call.name === 'deleteProject') {
            draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
            draftActions.push({
              id: generateId(),
              entityType: 'project',
              action: 'delete',
              entityId: args.id as string | undefined,
            });
            continue;
          }
          if (call.name === 'createTask') {
            draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
            draftActions.push({
              id: generateId(),
              entityType: 'task',
              action: 'create',
              after: {
                projectId: args.projectId,
                title: args.title,
                description: args.description,
                status: args.status,
                priority: args.priority,
                wbs: args.wbs,
                startDate: args.startDate,
                dueDate: args.dueDate,
                completion: args.completion,
                assignee: args.assignee,
                isMilestone: args.isMilestone,
                predecessors: args.predecessors,
              },
            });
            continue;
          }
          if (call.name === 'updateTask') {
            draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
            draftActions.push({
              id: generateId(),
              entityType: 'task',
              action: 'update',
              entityId: args.id as string | undefined,
              after: {
                title: args.title,
                description: args.description,
                status: args.status,
                priority: args.priority,
                wbs: args.wbs,
                startDate: args.startDate,
                dueDate: args.dueDate,
                completion: args.completion,
                assignee: args.assignee,
                isMilestone: args.isMilestone,
                predecessors: args.predecessors,
              },
            });
            continue;
          }
          if (call.name === 'deleteTask') {
            draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
            draftActions.push({
              id: generateId(),
              entityType: 'task',
              action: 'delete',
              entityId: args.id as string | undefined,
            });
          }
        }

        if (draftActions.length > 0) {
          const draft = await submitDraft(draftActions, { createdBy: 'agent', autoApply: false, reason: draftReason });
          toolResults.push(`Draft ${draft.id} created with ${draftActions.length} action(s).`);
        }

        if (toolResults.length > 0) {
          appendSystemMessage(toolResults.join(' | '));
          if (!finalText) finalText = 'Draft created. Review pending changes before applying.';
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
  }, [
    isProcessing,
    inputText,
    pendingAttachments,
    messages,
    activeTasks,
    activeProject,
    projects,
    submitDraft,
    handleApplyDraft,
    appendSystemMessage
  ]);

  return {
    messages,
    setMessages,
    inputText,
    setInputText,
    isProcessing,
    pendingAttachments,
    handleAttachFiles,
    handleRemoveAttachment,
    handleSendMessage,
    messagesEndRef,
    fileInputRef
  };
};
