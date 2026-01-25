import React, { useState, useRef, useCallback } from 'react';
import { aiService } from '../../services/aiService';
import { apiService } from '../../services/apiService';
import { ChatMessage, ChatAttachment, DraftAction, Project, Task } from '../../types';
import { generateId } from '../utils';

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

type AiMessagePart = {
  text: string;
};

type AiHistoryItem = {
  role: 'user' | 'model';
  parts: AiMessagePart[];
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

  const processConversationTurn = useCallback(async (
    initialHistory: AiHistoryItem[],
    userMessage: string,
    systemContext: string,
    attempt: number = 0
  ) => {
    const MAX_RETRIES = 3;
    
    // Call AI Service (streaming for faster feedback)
    if (attempt === 0) {
      pushProcessingStep('调用 AI 模型');
      setThinkingPreview('正在处理请求...');
    } else {
      pushProcessingStep(`自动重试 (${attempt}/${MAX_RETRIES})`);
      setThinkingPreview(`正在尝试修正结果 (${attempt}/${MAX_RETRIES})...`);
    }

    const updateThinkingPreview = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const maxLen = 160;
      const start = Math.max(0, trimmed.length - maxLen);
      const tail = trimmed.slice(start);
      setThinkingPreview(start > 0 ? `...${tail}` : tail);
    };

    try {
      const response = await aiService.sendMessageStream(
        initialHistory,
        userMessage,
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

      let finalText = response.text;
      const toolResults: string[] = [];
      const draftActions: DraftAction[] = [];
      let draftReason: string | undefined;
      let shouldRetry = false;
      let retryReason = '';

      if (response.toolCalls && response.toolCalls.length > 0) {
        pushProcessingStep('执行工具调用');
        for (const call of response.toolCalls) {
          const args = (call.args || {}) as Record<string, unknown>;
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
            const sample = result.data.slice(0, 5).map(task => {
              const startDateStr = task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : 'N/A';
              const dueDateStr = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'N/A';
              return `${task.title} (${startDateStr} - ${dueDateStr})`;
            }).join(', ');
            toolResults.push(`Tasks (${result.total}): ${sample}${result.total > 5 ? '…' : ''}`);
            continue;
          }
          if (call.name === 'getTask') {
            if (typeof args.id === 'string') {
              pushProcessingStep('读取任务详情');
              const task = await apiService.getTask(args.id);
              const startDateStr = task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : 'N/A';
              const dueDateStr = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'N/A';
              const taskInfo = `Task: ${task.title} (ID: ${task.id}, Start: ${startDateStr}, Due: ${dueDateStr}, Status: ${task.status})`;
              toolResults.push(taskInfo);
            }
            continue;
          }
          if (call.name === 'planChanges') {
            if (Array.isArray(args.actions)) {
              pushProcessingStep('生成草稿计划');
              const rawActions = Array.isArray(args.actions) ? args.actions : [];
              const actions = rawActions.map((action: any) => {
                if (!action || typeof action !== 'object') return null;

                const processedAfter = { ...(action.after || {}) };
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
              }).filter((a) => a !== null) as DraftAction[];

              draftReason = typeof args.reason === 'string' ? args.reason : draftReason;

              if (actions.length === 0) {
                shouldRetry = true;
                retryReason = "The previous `planChanges` call contained no actions. Please verify task IDs and criteria, then ensure you populate the `actions` array correctly.";
                break;
              } else {
                await submitDraft(actions, { createdBy: 'agent', autoApply: false, reason: draftReason });
              }
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

        if (!shouldRetry) {
          if (draftActions.length > 0) {
            pushProcessingStep('提交草稿');
            try {
              const draft = await submitDraft(draftActions, { createdBy: 'agent', autoApply: false, reason: draftReason });
              toolResults.push(`Draft ${draft.id} created with ${draftActions.length} action(s).`);
            } catch (draftError) {
              const errorMessage = draftError instanceof Error ? draftError.message : String(draftError);
              toolResults.push(`Failed to create draft: ${errorMessage}`);
              finalText = errorMessage;
            }
          }

          if (toolResults.length > 0) {
            pushProcessingStep('汇总工具结果');
            appendSystemMessage(toolResults.join(' | '));
            if (!finalText) finalText = 'Draft created. Review pending changes before applying.';
          }
        }
      } else {
        pushProcessingStep('生成回复');
      }

      if (shouldRetry && attempt < MAX_RETRIES) {
         const nextHistory = [
             ...initialHistory,
             { role: 'model', parts: [{ text: response.text || "I will plan the changes." }] }
         ];
         await processConversationTurn(nextHistory, `System Alert: ${retryReason}`, systemContext, attempt + 1);
         return;
      }

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: finalText || (shouldRetry ? "Failed to generate a valid plan after retries." : "Processed."),
        timestamp: Date.now()
      }]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sorry, something went wrong.";
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: `Error: ${errorMessage}`,
        timestamp: Date.now()
      }]);
    }
  }, [activeProjectId, aiService, apiService, submitDraft, handleApplyDraft, appendSystemMessage, pushProcessingStep, setMessages, setThinkingPreview]);

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
                             ${selectedTask ? (() => {
                               const startDateStr = selectedTask.startDate ? new Date(selectedTask.startDate).toISOString().split('T')[0] : 'N/A';
                               const dueDateStr = selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : 'N/A';
                               return `User is currently inspecting task: ${selectedTask.title} (ID: ${selectedTask.id}, Status: ${selectedTask.status}, Start: ${startDateStr}, Due: ${dueDateStr}).`;
                             })() : ''}
                             Available Projects: ${projects.map(p => `${p.name} (${p.id})`).join(', ')}.
                             ${
                               shouldIncludeFullMappings
                                 ? `Task IDs in Active Project (JSON): ${mappingJson}.`
                                 : `Task IDs in Active Project (compact JSON): ${mappingJson}.`
                             }`;

      await processConversationTurn(history, userMsg.text, systemContext, 0);

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
    selectedTask,
    projects,
    pushProcessingStep,
    processConversationTurn 
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
