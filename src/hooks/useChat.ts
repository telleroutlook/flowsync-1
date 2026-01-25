import React, { useState, useRef, useCallback } from 'react';
import { aiService } from '../../services/aiService';
import { apiService } from '../../services/apiService';
import { ChatMessage, ChatAttachment, DraftAction, Project, Task } from '../../types';
import { generateId } from '../utils';
import { processToolCalls, type ApiClient, type ProcessingStep } from './ai';

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

// Stage name mapping for UI display
const STAGE_LABELS: Record<string, string> = {
      received: 'Request Received',
      prepare_request: 'Preparing Context',
      upstream_request: 'Calling AI Model',
      upstream_response: 'Parsing Response',
      done: 'Done',};

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

  // Build system context for the AI
  const buildSystemContext = useCallback((): string => {
    const maxContextTasks = 30;
    const limitedTasks = activeTasks.slice(0, maxContextTasks);
    const taskIdMap = limitedTasks.map(task => ({ id: task.id, title: task.title }));
    const wbsIdMap = limitedTasks
      .filter(task => task.wbs)
      .map(task => ({ id: task.id, wbs: task.wbs || '' }));

    const shouldIncludeFullMappings = activeTasks.length > maxContextTasks;
    const mappingJson = shouldIncludeFullMappings
      ? JSON.stringify({ limit: maxContextTasks, total: activeTasks.length, taskIdMap, wbsIdMap })
      : JSON.stringify({ total: activeTasks.length, taskIdMap });

    const formatDate = (ts: number | null | undefined) => {
      if (!ts) return 'N/A';
      return new Date(ts).toISOString().split('T')[0];
    };

    const selectedTaskInfo = selectedTask
      ? `User is currently inspecting task: ${selectedTask.title} (ID: ${selectedTask.id}, Status: ${selectedTask.status}, Start: ${formatDate(selectedTask.startDate)}, Due: ${formatDate(selectedTask.dueDate)}).`
      : '';

    return `Active Project: ${activeProject.name || 'None'}.
Active Project ID: ${activeProject.id || 'N/A'}.
${selectedTaskInfo}
Available Projects: ${projects.map(p => `${p.name} (${p.id})`).join(', ')}.
${
  shouldIncludeFullMappings
    ? `Task IDs in Active Project (JSON): ${mappingJson}.`
    : `Task IDs in Active Project (compact JSON): ${mappingJson}.`
}`;
  }, [activeProject, activeTasks, selectedTask, projects]);

  // Process a single conversation turn with the AI
  const processConversationTurn = useCallback(async (
    initialHistory: AiHistoryItem[],
    userMessage: string,
    systemContext: string,
    attempt: number = 0
  ) => {
    const MAX_RETRIES = 3;

      pushProcessingStep('Calling AI Model');
      setThinkingPreview('Processing request...');
      
      if (attempt > MAX_RETRIES) {
        throw new Error('Max retries exceeded');
      }
      if (attempt > 0) {
        pushProcessingStep(`Auto Retry (${attempt}/${MAX_RETRIES})`);
        setThinkingPreview(`Attempting to fix results (${attempt}/${MAX_RETRIES})...`);
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
            pushProcessingStep('Generating Response', elapsedMs);
            return;
          }
          if (event === 'result' && typeof data.text === 'string') {
            updateThinkingPreview(data.text);
            return;
          }
          if (event === 'tool_start' && typeof data.name === 'string') {
            pushProcessingStep(`Executing Tool: ${data.name}`, elapsedMs);
            return;
          }
          if (event === 'stage' && typeof data.name === 'string') {
            const label = STAGE_LABELS[data.name];
            if (label) pushProcessingStep(label, elapsedMs);
            return;
          }
          if (event === 'retry') {
            pushProcessingStep('Retrying Request', elapsedMs);
          }
        }
      );

      let finalText = response.text;

      // Process tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
                    pushProcessingStep('Executing Tool Call');
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
          pushProcessingStep('Submitting Draft');
          try {
            const draft = await submitDraft(result.draftActions, {
              createdBy: 'agent',
              autoApply: false,
              reason: result.draftReason,
            });
            result.outputs.push(`Draft ${draft.id} created with ${result.draftActions.length} action(s).`);
          } catch (draftError) {
            const errorMessage = draftError instanceof Error ? draftError.message : String(draftError);
            result.outputs.push(`Failed to create draft: ${errorMessage}`);
            finalText = errorMessage;
          }
        }

        // Display tool results
        if (result.outputs.length > 0) {
      pushProcessingStep('Aggregating Tool Results');
      
      // const summaryRequest: RequestInput = {
      //   history: [...messages, ...newMessages],
      //   message: 'The tool has been executed. Please verify the results and provide feedback or next steps based on the tool\'s output.',
      // };
      
      pushProcessingStep('Generating Response');
          appendSystemMessage(result.outputs.join(' | '));
          if (!finalText) finalText = 'Draft created. Review pending changes before applying.';
        }
      } else {
        pushProcessingStep('Generating Response');
      }

      // Add final AI message to chat
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: finalText || 'Processed.',
        timestamp: Date.now()
      }]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sorry, something went wrong.';
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: `Error: ${errorMessage}`,
        timestamp: Date.now()
      }]);
    }
  }, [activeProjectId, submitDraft, appendSystemMessage, pushProcessingStep, setMessages, setThinkingPreview]);

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
      pushProcessingStep('Preparing Context');

      const history: AiHistoryItem[] = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const systemContext = buildSystemContext();
      await processConversationTurn(history, userMsg.text, systemContext, 0);

    } catch {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'model',
        text: 'Sorry, something went wrong.',
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
    buildSystemContext
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
