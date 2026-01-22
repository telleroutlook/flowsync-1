import React from 'react';
import { ChatAttachment, ChatMessage } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasText = message.text.trim().length > 0;
  const attachments = message.attachments || [];

  const formatBytes = (value: number) => {
    if (value < 1024) return `${value} B`;
    const kb = value / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const renderAttachment = (attachment: ChatAttachment) => (
    <a
      key={attachment.id}
      href={attachment.url}
      download={attachment.name}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
        isUser
          ? 'border-indigo-400/30 bg-indigo-600/10 text-indigo-50 hover:bg-indigo-600/20'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
      rel="noreferrer"
    >
      <span aria-hidden className="text-base">📎</span>
      <div className="flex flex-col min-w-0">
        <span className="truncate font-medium">{attachment.name}</span>
        <span className={`text-[10px] ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
          {formatBytes(attachment.size)}
        </span>
      </div>
    </a>
  );

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 animate-fade-in">
        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[90%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-100'
            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-slate-100'
        }`}
      >
        {hasText && <div className="whitespace-pre-wrap">{message.text}</div>}
        {attachments.length > 0 && (
          <div className={`mt-3 flex flex-col gap-2 ${hasText ? '' : 'mt-0'}`}>
            {attachments.map(renderAttachment)}
          </div>
        )}
        <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 opacity-70`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isUser && <span>• You</span>}
        </div>
      </div>
    </div>
  );
};
