import React, { memo, useCallback, useMemo } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatMessage, ChatAttachment, Draft } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RotateCcw, X, Paperclip, Send, File, XCircle, AlertTriangle } from 'lucide-react';
import { useI18n } from '../src/i18n';
import { getActionLabel, getEntityLabel } from '../src/i18n/labels';
import { cn } from '../src/utils/cn';
import { Button } from './ui/Button';

interface ChatInterfaceProps {
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  pendingDraft: Draft | null;
  draftWarnings: string[];
  onApplyDraft: (draftId: string) => void;
  onDiscardDraft: (draftId: string) => void;
  messages: ChatMessage[];
  isProcessing: boolean;
  processingSteps: { label: string; elapsedMs?: number }[];
  thinkingPreview: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSendMessage: (e?: React.FormEvent) => void;
  pendingAttachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAttachFiles: (files: FileList | null) => void;
  inputText: string;
  setInputText: (text: string) => void;
  onResetChat: () => void;
}

export const ChatInterface = memo<ChatInterfaceProps>(({
  isChatOpen,
  setIsChatOpen,
  pendingDraft,
  draftWarnings,
  onApplyDraft,
  onDiscardDraft,
  messages,
  isProcessing,
  processingSteps,
  thinkingPreview,
  messagesEndRef,
  onSendMessage,
  pendingAttachments,
  onRemoveAttachment,
  fileInputRef,
  onAttachFiles,
  inputText,
  setInputText,
  onResetChat,
}) => {
  const { t } = useI18n();

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onAttachFiles(event.target.files);
    event.currentTarget.value = '';
  }, [onAttachFiles]);

  const handleTextareaChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = Math.min(event.target.scrollHeight, 120) + 'px';
  }, [setInputText]);

  const handleTextareaKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      target.style.height = 'auto';
      onSendMessage();
    }
  }, [onSendMessage]);

  return (
    <motion.div
      initial={false}
      animate={{ width: isChatOpen ? 360 : 0, opacity: isChatOpen ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col border-l border-border-subtle bg-surface relative z-20 shrink-0 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] h-full overflow-hidden"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-border-subtle flex items-center justify-between bg-surface/95 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-joule-start to-joule-end flex items-center justify-center shadow-md shadow-joule-start/20 ring-1 ring-black/5" aria-hidden="true">
            <Sparkles className="w-4 h-4 text-accent-foreground" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-text-primary tracking-tight">{t('chat.assistant_name')}</h1>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
              </span>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{t('chat.status_online')}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
             onClick={onResetChat}
             className="text-text-secondary hover:text-primary p-2 rounded-lg hover:bg-background transition-colors"
             title={t('chat.new_chat')}
          >
             <RotateCcw className="w-4 h-4" />
          </button>
          <button
             onClick={() => setIsChatOpen(false)}
             className="text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-background transition-colors"
             title={t('chat.close_chat')}
          >
             <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pending Draft Notification */}
      <AnimatePresence>
        {pendingDraft && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-3 border-b border-border-subtle border-l-4 border-l-critical bg-surface shrink-0"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-critical" aria-hidden="true" />
                <p className="text-xs font-bold text-text-primary">{t('chat.pending.title')}</p>
              </div>
              <span className="text-xs font-semibold text-critical bg-critical/10 px-2 py-0.5 rounded-full border border-critical/20">
                {t('chat.pending.action_count', { count: pendingDraft.actions.length })}
              </span>
            </div>
            <div className="space-y-1 pl-5 mb-3">
              {pendingDraft.actions.slice(0, 3).map(action => (
                <div key={action.id} className="text-xs text-text-secondary truncate font-medium">
                  {getActionLabel(action.action, t)} <span className="opacity-75">{getEntityLabel(action.entityType, t)}</span>
                </div>
              ))}
              {pendingDraft.actions.length > 3 && (
                <div className="text-xs text-critical italic">{t('chat.pending.more', { count: pendingDraft.actions.length - 3 })}</div>
              )}
            </div>
            <div className="flex gap-2 pl-5">
              <Button
                variant="default"
                size="sm"
                onClick={() => onApplyDraft(pendingDraft.id)}
                className="flex-1 h-8 bg-success hover:bg-success/90 text-success-foreground"
              >
                {t('chat.accept')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDiscardDraft(pendingDraft.id)}
                className="flex-1 h-8"
              >
                {t('chat.discard')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-background scroll-smooth">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking Indicator */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex justify-start mb-4"
            >
               <div className="bg-surface px-4 py-3 rounded-2xl rounded-bl-none border border-border-subtle shadow-sm max-w-[85%]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-sm font-semibold text-joule-start">{t('chat.thinking')}</span>
                    <div className="flex gap-1" aria-hidden="true">
                      <motion.span
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                        className="w-1.5 h-1.5 bg-joule-start rounded-full"
                      />
                      <motion.span
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                        className="w-1.5 h-1.5 bg-joule-start rounded-full"
                      />
                      <motion.span
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
                        className="w-1.5 h-1.5 bg-joule-start rounded-full"
                      />
                    </div>
                  </div>

                  {thinkingPreview && (
                    <div className="text-xs text-text-secondary italic border-l-2 border-border-subtle pl-2 mb-2">
                      {thinkingPreview}
                    </div>
                  )}

                  {processingSteps.length > 0 && (
                    <div className="space-y-1">
                      {processingSteps.map((step, index) => (
                        <motion.div
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={`${step.label}-${index}`}
                          className="flex items-center gap-1.5 text-xs text-text-secondary"
                        >
                          <div className="w-1 h-1 rounded-full bg-success" aria-hidden="true"></div>
                          <span>{step.label}</span>
                          {typeof step.elapsedMs === 'number' && (
                             <span className="opacity-50">· {(step.elapsedMs / 1000).toFixed(1)}s</span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border-subtle bg-surface z-20 shrink-0">
        <form onSubmit={onSendMessage} className="relative group">

          {/* File Attachments Preview */}
          {pendingAttachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-3 flex flex-wrap gap-2"
            >
              {pendingAttachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  <File className="w-3 h-3" aria-hidden="true" />
                  <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file.id)}
                    className="text-primary/60 hover:text-primary p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          <div className="flex items-end gap-2 bg-background p-2 rounded-xl border border-border-subtle focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileInputChange}
              disabled={isProcessing}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-surface transition-colors"
              disabled={isProcessing}
              title={t('chat.attach_files')}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              rows={1}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder={t('chat.placeholder')}
              className="w-full bg-transparent text-text-primary py-2.5 outline-none placeholder:text-text-secondary/60 text-sm resize-none max-h-[120px] custom-scrollbar leading-relaxed"
              disabled={isProcessing}
            />

            <button
              type="submit"
              disabled={(inputText.trim().length === 0 && pendingAttachments.length === 0) || isProcessing}
              className="h-9 w-9 shrink-0 flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-sm"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 translate-x-0.5 translate-y-0.5" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
});
ChatInterface.displayName = 'ChatInterface';
