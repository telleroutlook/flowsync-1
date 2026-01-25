import React from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatMessage, ChatAttachment, Draft } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RotateCcw, X, Paperclip, Send, File, XCircle, AlertTriangle } from 'lucide-react';

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

export const ChatInterface = React.memo<ChatInterfaceProps>(({
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-joule-start to-joule-end flex items-center justify-center shadow-md shadow-joule-start/20 ring-1 ring-black/5">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-text-primary tracking-tight">Joule Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
              </span>
              <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
             onClick={onResetChat}
             className="text-text-secondary hover:text-primary p-2 rounded-lg hover:bg-background transition-colors"
             title="New Chat"
          >
             <RotateCcw className="w-4 h-4" />
          </button>
          <button 
             onClick={() => setIsChatOpen(false)}
             className="text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-background transition-colors"
             title="Close Chat"
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
            className="px-4 py-3 border-b border-amber-200/50 bg-amber-50/60 shrink-0 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-[11px] font-bold text-amber-900">Review Pending Draft</p>
              </div>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                {pendingDraft.actions.length} action(s)
              </span>
            </div>
            <div className="space-y-1 pl-5 mb-3">
              {pendingDraft.actions.slice(0, 3).map(action => (
                <div key={action.id} className="text-[10px] text-amber-800 truncate font-medium">
                  • {action.action.toUpperCase()} <span className="opacity-75">{action.entityType}</span>
                </div>
              ))}
              {pendingDraft.actions.length > 3 && (
                <div className="text-[10px] text-amber-700 italic">+{pendingDraft.actions.length - 3} more...</div>
              )}
            </div>
            <div className="flex gap-2 pl-5">
              <button
                type="button"
                onClick={() => onApplyDraft(pendingDraft.id)}
                className="flex-1 rounded-lg bg-success text-white text-[11px] font-semibold py-1.5 hover:bg-success/90 transition-colors shadow-sm"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => onDiscardDraft(pendingDraft.id)}
                className="flex-1 rounded-lg bg-white border border-border-subtle text-text-secondary text-[11px] font-semibold py-1.5 hover:bg-background hover:text-text-primary transition-colors"
              >
                Discard
              </button>
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
                    <span className="text-xs font-semibold text-joule-start">Joule thinking</span>
                    <div className="flex gap-1">
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
                    <div className="text-[10px] text-text-secondary italic border-l-2 border-border-subtle pl-2 mb-2">
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
                          className="flex items-center gap-1.5 text-[10px] text-text-secondary"
                        >
                          <div className="w-1 h-1 rounded-full bg-success"></div>
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
                  className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary"
                >
                  <File className="w-3 h-3" />
                  <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file.id)}
                    className="text-primary/60 hover:text-primary p-0.5 rounded-full hover:bg-primary/10 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          <div className="flex items-end gap-2 bg-background p-2 rounded-xl border border-border-subtle focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(event) => {
                onAttachFiles(event.target.files);
                event.currentTarget.value = '';
              }}
              disabled={isProcessing}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-white transition-colors"
              disabled={isProcessing}
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  onSendMessage();
                }
              }}
              placeholder="Ask Joule..."
              className="w-full bg-transparent text-text-primary py-2.5 outline-none placeholder:text-text-secondary/60 text-sm resize-none max-h-[120px] custom-scrollbar leading-relaxed"
              disabled={isProcessing}
            />
            
            <button 
              type="submit"
              disabled={(inputText.trim().length === 0 && pendingAttachments.length === 0) || isProcessing}
              className="h-9 w-9 shrink-0 flex items-center justify-center bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-sm"
            >
              <Send className="w-4 h-4 translate-x-0.5 translate-y-0.5" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
});
