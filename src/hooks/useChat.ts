import React, { useState, useRef, useCallback, useMemo } from 'react';
import { aiService } from '../../services/aiService';
import { apiService } from '../../services/apiService';
import { ChatMessage, ChatAttachment, DraftAction, Project, Task } from '../../types';
import { generateId } from '../utils';
import { processToolCalls, type ApiClient, type ProcessingStep } from './ai';
import { useI18n } from '../i18n';

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

type AiHistoryItem = {
  role: 'user' | 'model';
  parts: { text: string }[];
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
  const { t } = useI18n();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [thinkingPreview, setThinkingPreview] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageLabels = useMemo<Record<string, string>>(() => ({
    received: t('processing.received'),
    prepare_request: t('processing.preparing'),
    upstream_request: t('processing.calling_ai'),
    upstream_response: t('processing.parsing'),
    done: t('processing.done'),
  }), [t]);

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

  // Build system context for the AI - memoized with stable dependencies
  const projectId = activeProject.id;
  const projectName = activeProject.name;
  const activeTaskCount = activeTasks.length;
  const taskIdsAndTitles = useMemo(
    () => activeTasks.slice(0, 30).map(task => ({ id: task.id, title: task.title })),
    [activeTasks]
  );
  const selectedTaskId = selectedTask?.id;
  const selectedTaskTitle = selectedTask?.title;
  const selectedTaskStatus = selectedTask?.status;
  const selectedTaskStart = selectedTask?.startDate;
  const selectedTaskDue = selectedTask?.dueDate;
  const projectList = useMemo(
    () => projects.map(p => `${p.name} (${p.id})`).join(', '),
    [projects]
  );

  const systemContext = useMemo(() => {
    const taskIdMap = taskIdsAndTitles;
    const mappingJson = JSON.stringify({
      limit: 30,
      total: activeTaskCount,
      taskIdMap
    });

    const formatDate = (ts: number | null | undefined) => {
      if (!ts) return 'N/A';
      return new Date(ts).toISOString().split('T')[0];
    };

    const selectedTaskInfo = selectedTaskId
      ? `User is currently inspecting task: ${selectedTaskTitle} (ID: ${selectedTaskId}, Status: ${selectedTaskStatus}, Start: ${formatDate(selectedTaskStart)}, Due: ${formatDate(selectedTaskDue)}).`
      : '';

    return `Active Project: ${projectName || 'None'}.
Active Project ID: ${projectId || 'N/A'}.
${selectedTaskInfo}
Available Projects: ${projectList}.
Task IDs in Active Project (JSON): ${mappingJson}.`;
  }, [projectId, projectName, activeTaskCount, taskIdsAndTitles, selectedTaskId, selectedTaskTitle, selectedTaskStatus, selectedTaskStart, selectedTaskDue, projectList]);

  // Process a single conversation turn with the AI
  const processConversationTurn = useCallback(async (
    initialHistory: AiHistoryItem[],
    userMessage: string,
    systemContext: string,
    attempt: number = 0
  ) => {
      const MAX_RETRIES = 3;

      pushProcessingStep(t('processing.calling_ai'));
      setThinkingPreview(t('chat.processing_request'));
      
      if (attempt > MAX_RETRIES) {
        throw new Error(t('chat.max_retries'));
      }
      if (attempt > 0) {
        pushProcessingStep(t('chat.auto_retry', { attempt, max: MAX_RETRIES }));
        setThinkingPreview(t('chat.attempt_fix', { attempt, max: MAX_RETRIES }));
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
      // Call AI Service with streaming for faster feedback
      const response = await aiService.sendMessageStream(
        initialHistory,
        userMessage,
        systemContext,
        (event, data) => {
          const elapsedMs = typeof data.elapsedMs === 'number' ? data.elapsedMs : undefined;

          if (event === 'assistant_text' && typeof data.text === 'string') {
            updateThinkingPreview(data.text);
            pushProcessingStep(t('processing.generating'), elapsedMs);
            return;
          }
          if (event === 'result' && typeof data.text === 'string') {
            updateThinkingPreview(data.text);
            return;
          }
          if (event === 'tool_start' && typeof data.name === 'string') {
            pushProcessingStep(t('processing.executing_tool', { name: data.name }), elapsedMs);
            return;
          }
          if (event === 'stage' && typeof data.name === 'string') {
            const label = stageLabels[data.name];
            if (label) pushProcessingStep(label, elapsedMs);
            return;
          }
          if (event === 'retry') {
            pushProcessingStep(t('chat.retrying'), elapsedMs);
          }
        }
      );

      let finalText = response.text;

      // Process tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        pushProcessingStep(t('processing.executing_tool_call'));
        // Create API client context for tool handlers
        const apiClient: ApiClient = {
          listProjects: () => apiService.listProjects(),
          getProject: (id: string) => apiService.getProject(id),
          listTasks: (params) => apiService.listTasks(params),
          getTask: (id: string) => apiService.getTask(id),
          createDraft: (data) => apiService.createDraft(data),
          applyDraft: (id, actor) => apiService.applyDraft(id, actor),
        };

        // Execute all tool calls using the centralized handler
        const result = await processToolCalls(
          response.toolCalls.map(call => ({ name: call.name, args: (call.args || {}) as Record<string, unknown> })),
          {
            api: apiClient,
            activeProjectId,
            generateId,
            pushProcessingStep,
            t,
          }
        );

        // Handle retry logic for invalid responses
        if (result.shouldRetry && attempt < MAX_RETRIES) {
          const nextHistory: AiHistoryItem[] = [
            ...initialHistory,
            { role: 'model', parts: [{ text: response.text || 'I will plan the changes.' }] }
          ];
          await processConversationTurn(nextHistory, `System Alert: ${result.retryReason}`, systemContext, attempt + 1);
          return;
        }

        // Submit draft if there are actions to apply
        if (result.draftActions.length > 0) {
          pushProcessingStep(t('processing.submitting_draft'));
          try {
            const draft = await submitDraft(result.draftActions, {
              createdBy: 'agent',
              autoApply: false,
              reason: result.draftReason,
            });
            result.outputs.push(t('draft.created_action_count', { id: draft.id, count: result.draftActions.length }));
          } catch (draftError) {
            const errorMessage = draftError instanceof Error ? draftError.message : String(draftError);
            result.outputs.push(t('draft.create_failed', { error: errorMessage }));
            finalText = errorMessage;
          }
        }

        // Display tool results
        if (result.outputs.length > 0) {
      pushProcessingStep(t('processing.aggregating_tool_results'));
      
      // const summaryRequest: RequestInput = {
      //   history: [...messages, ...newMessages],
      //   message: 'The tool has been executed. Please verify the results and provide feedback or next steps based on the tool\'s output.',
      // };
      
      pushProcessingStep(t('processing.generating'));
          appendSystemMessage(result.outputs.join(' | '));
          if (!finalText) finalText = t('chat.draft_created_review');
        }
      } else {
        pushProcessingStep(t('processing.generating'));
      }

      // Add final AI message to chat
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: finalText || t('chat.processed'),
        timestamp: Date.now()
      }]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('chat.error_generic');
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: t('chat.error_prefix', { error: errorMessage }),
        timestamp: Date.now()
      }]);
    }
  }, [activeProjectId, submitDraft, appendSystemMessage, pushProcessingStep, setMessages, setThinkingPreview, t, stageLabels]);

  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isProcessing) return;

    const cleanedInput = inputText.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!cleanedInput && !hasAttachments) return;

    const outgoingText = cleanedInput || t('chat.sent_attachments');

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
      pushProcessingStep(t('processing.preparing'));

      const history: AiHistoryItem[] = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      await processConversationTurn(history, userMsg.text, systemContext, 0);

    } catch {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: t('chat.error_generic'),
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
    pushProcessingStep,
    processConversationTurn,
    systemContext,
    t
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
