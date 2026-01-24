import React from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatMessage, ChatAttachment, Draft } from '../types';

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
    <div 
      className={`${
        isChatOpen ? 'w-[340px] border-r' : 'w-0 border-none'
      } flex flex-col border-slate-200 bg-white relative z-20 shrink-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden`}
    >
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 ring-1 ring-black/5">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-900 tracking-tight leading-tight">FlowSync</h1>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">AI Assistant Online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
             onClick={onResetChat}
             className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-50 transition-colors"
             title="New Chat / Clear History"
          >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
             </svg>
          </button>
          <button 
             onClick={() => setIsChatOpen(false)}
             className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
             title="Close Chat"
          >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
             </svg>
          </button>
        </div>
      </div>

      {pendingDraft && (
        <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/40">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-amber-900">Pending Draft</p>
              <p className="text-[10px] text-amber-700">ID: {pendingDraft.id}</p>
            </div>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              {pendingDraft.actions.length} action(s)
            </span>
          </div>
          <div className="space-y-1">
            {pendingDraft.actions.slice(0, 4).map(action => (
              <div key={action.id} className="text-[10px] text-amber-700">
                {action.action.toUpperCase()} {action.entityType} {action.entityId ? `(${action.entityId})` : ''}
              </div>
            ))}
            {pendingDraft.actions.length > 4 && (
              <div className="text-[10px] text-amber-600">+{pendingDraft.actions.length - 4} more</div>
            )}
          </div>
          {draftWarnings.length > 0 && (
            <div className="mt-2 text-[10px] text-amber-800">
              Warnings: {draftWarnings.join(' | ')}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onApplyDraft(pendingDraft.id)}
              className="flex-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold py-1.5 hover:bg-emerald-700 transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => onDiscardDraft(pendingDraft.id)}
              className="flex-1 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-semibold py-1.5 hover:bg-amber-100 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 scroll-smooth">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isProcessing && (
          <div className="flex justify-start mb-4 animate-fade-in">
             <div className="bg-white px-4 py-3.5 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Thinking</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
                {thinkingPreview && (
                  <div className="mt-2 text-[10px] text-slate-500 italic">
                    {thinkingPreview}
                  </div>
                )}
                {processingSteps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {processingSteps.map((step, index) => (
                      <div
                        key={`${step.label}-${index}`}
                        className="text-[10px] text-slate-500"
                      >
                        {step.label}
                        {typeof step.elapsedMs === 'number' ? ` · ${(step.elapsedMs / 1000).toFixed(1)}s` : ''}
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-20">
        <form onSubmit={onSendMessage} className="relative group">
          {pendingAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 animate-slide-up">
              {pendingAttachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs text-indigo-700"
                >
                  <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file.id)}
                    className="text-indigo-400 hover:text-indigo-700 p-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-inner">
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mb-0.5"
              disabled={isProcessing}
              title="Attach files"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
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
                  // Reset height
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  onSendMessage();
                }
              }}
              placeholder="Ask AI to update tasks..."
              className="w-full bg-transparent text-slate-900 py-2.5 outline-none placeholder:text-slate-400 text-sm font-medium resize-none max-h-[120px] custom-scrollbar"
              disabled={isProcessing}
            />
            
            <button 
              type="submit"
              disabled={(inputText.trim().length === 0 && pendingAttachments.length === 0) || isProcessing}
              className="h-9 w-9 shrink-0 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-200 mb-0.5"
            >
              <svg className="w-4 h-4 translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
