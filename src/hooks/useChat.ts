import React, { useState, useRef, useCallback } from 'react';
import { aiService } from '../../services/aiService';
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
  selectedTask?: Task | null;
  projects: Project[];
  refreshData: () => Promise<void>;
  submitDraft: (actions: DraftAction[], options: { reason?: string; createdBy: string; autoApply?: boolean; silent?: boolean }) => Promise<any>;
  handleApplyDraft: (draftId: string) => Promise<void>;
  appendSystemMessage: (text: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

type ProcessingStep = {
  label: string;
  elapsedMs?: number;
};

export const useChat = ({
  activeProjectId,
  activeProject,
  activeTasks,
  selectedTask,
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
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [thinkingPreview, setThinkingPreview] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pushProcessingStep = useCallback((step: string, elapsedMs?: number) => {
    setProcessingSteps(prev => {
      if (prev[prev.length - 1]?.label === step) return prev;
      const next = [...prev, { label: step, elapsedMs }];
      return next.slice(-6);
    });
  }, []);

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
    setProcessingSteps([]);
    setThinkingPreview('');

    try {
      pushProcessingStep('整理上下文');
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
                             ${selectedTask ? `User is currently inspecting task: ${selectedTask.title} (ID: ${selectedTask.id}, Status: ${selectedTask.status}).` : ''}
                             Available Projects: ${projects.map(p => `${p.name} (${p.id})`).join(', ')}.
                             ${ 
                               shouldIncludeFullMappings
                                 ? `Task IDs in Active Project (JSON): ${mappingJson}.` 
                                 : `Task IDs in Active Project (compact JSON): ${mappingJson}.`
                             }`;

      // Call AI Service (streaming for faster feedback)
      pushProcessingStep('调用 AI 模型');

      // 设置初始的 thinking preview
      setThinkingPreview('正在处理请求...');

      const updateThinkingPreview = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const maxLen = 160;
        const start = Math.max(0, trimmed.length - maxLen);
        const tail = trimmed.slice(start);
        setThinkingPreview(start > 0 ? `...${tail}` : tail);
      };

      const response = await aiService.sendMessageStream(
        history,
        userMsg.text,
        systemContext,
        (event, data) => {
          const elapsedMs = typeof data.elapsedMs === 'number' ? data.elapsedMs : undefined;
          if (event === 'assistant_text' && typeof data.text === 'string') {
            updateThinkingPreview(data.text);
            pushProcessingStep('生成回复', elapsedMs);
            return;
          }
          if (event === 'result' && typeof data.text === 'string') {
            updateThinkingPreview(data.text);
            return;
          }
          if (event === 'tool_start' && typeof data.name === 'string') {
            pushProcessingStep(`执行工具: ${data.name}`, elapsedMs);
            return;
          }
          if (event === 'stage' && typeof data.name === 'string') {
            const stageMap: Record<string, string> = {
              received: '请求已接收',
              prepare_request: '整理上下文',
              upstream_request: '调用 AI 模型',
              upstream_response: '解析 AI 响应',
              done: '完成',
            };
            const label = stageMap[data.name];
            if (label) pushProcessingStep(label, elapsedMs);
            return;
          }
          if (event === 'retry') {
            pushProcessingStep('请求重试', elapsedMs);
          }
        }
      );

      console.log('[useChat] AI Response:', {
        hasText: !!response.text,
        textLength: response.text?.length,
        toolCallsCount: response.toolCalls?.length || 0,
        toolCalls: response.toolCalls,
      });

      let finalText = response.text;
      const toolResults: string[] = [];
      const draftActions: DraftAction[] = [];
      let draftReason: string | undefined;

      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('[useChat] Processing tool calls:', response.toolCalls);
        pushProcessingStep('执行工具调用');
        for (const call of response.toolCalls) {
          const args = (call.args || {}) as Record<string, unknown>;
          console.log('[useChat] Processing tool:', call.name, 'args:', args);
          pushProcessingStep(`执行工具: ${call.name}`);
          
          if (call.name === 'listProjects') {
            pushProcessingStep('读取项目列表');
            const list = await apiService.listProjects();
            toolResults.push(`Projects (${list.length}): ${list.map(p => `${p.name} (${p.id})`).join(', ')}`);
            continue;
          }
          if (call.name === 'getProject') {
            if (typeof args.id === 'string') {
              pushProcessingStep('读取项目详情');
              const project = await apiService.getProject(args.id);
              toolResults.push(`Project: ${project.name} (${project.id})`);
            }
            continue;
          }
          if (call.name === 'listTasks' || call.name === 'searchTasks') {
            pushProcessingStep('读取任务列表');
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
              pushProcessingStep('读取任务详情');
              const task = await apiService.getTask(args.id);
              toolResults.push(`Task: ${task.title} (${task.id})`);
            }
            continue;
          }
          if (call.name === 'planChanges') {
            if (Array.isArray(args.actions)) {
              pushProcessingStep('生成草稿计划');
              // Directly submit draft from planChanges
              const actions = (args.actions as DraftAction[]).map(action => {
                const processedAfter = { ...action.after };
                // Auto-fill projectId for task creation actions if not provided
                if (action.entityType === 'task' && action.action === 'create' && !processedAfter.projectId) {
                  processedAfter.projectId = activeProjectId;
                }
                return {
                  id: action.id || generateId(),
                  entityType: action.entityType,
                  action: action.action,
                  entityId: action.entityId,
                  after: processedAfter,
                };
              });
              draftReason = typeof args.reason === 'string' ? args.reason : draftReason;
              await submitDraft(actions, { createdBy: 'agent', autoApply: false, reason: draftReason });
            }
            continue;
          }
          if (call.name === 'applyChanges') {
            if (typeof args.draftId === 'string') {
              pushProcessingStep('应用草稿');
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
                projectId: args.projectId || activeProjectId,
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

        console.log('[useChat] Draft actions collected:', {
          count: draftActions.length,
          actions: draftActions,
        });

        if (draftActions.length > 0) {
          console.log('[useChat] Submitting draft...');
          pushProcessingStep('提交草稿');
          try {
            const draft = await submitDraft(draftActions, { createdBy: 'agent', autoApply: false, reason: draftReason });
            console.log('[useChat] Draft created successfully:', draft.id);
            toolResults.push(`Draft ${draft.id} created with ${draftActions.length} action(s).`);
          } catch (draftError) {
            console.error('[useChat] Failed to create draft:', draftError);
            toolResults.push(`Failed to create draft: ${draftError instanceof Error ? draftError.message : String(draftError)}`);
          }
        } else {
          console.log('[useChat] No draft actions to submit');
        }

        if (toolResults.length > 0) {
          pushProcessingStep('汇总工具结果');
          appendSystemMessage(toolResults.join(' | '));
          if (!finalText) finalText = 'Draft created. Review pending changes before applying.';
        }
      } else {
        console.log('[useChat] No tool calls received from AI');
        console.log('[useChat] AI response text:', finalText);
        pushProcessingStep('生成回复');
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
      setProcessingSteps([]);
      setThinkingPreview('');
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
    appendSystemMessage,
    pushProcessingStep
  ]);

  return {
    messages,
    setMessages,
    inputText,
    setInputText,
    isProcessing,
    processingSteps,
    thinkingPreview,
    pendingAttachments,
    handleAttachFiles,
    handleRemoveAttachment,
    handleSendMessage,
    messagesEndRef,
    fileInputRef
  };
};
