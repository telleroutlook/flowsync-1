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
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
        isUser
          ? 'border-indigo-200/40 bg-indigo-500/20 text-indigo-50 hover:bg-indigo-500/30'
          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
      }`}
      rel="noreferrer"
    >
      <span aria-hidden className="text-sm">📎</span>
      <span className="line-clamp-1">{attachment.name}</span>
      <span className={isUser ? 'text-indigo-100' : 'text-slate-400'}>
        {formatBytes(attachment.size)}
      </span>
    </a>
  );

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-primary text-white rounded-br-none shadow-indigo-100'
            : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
        }`}
      >
        {hasText && <div className="whitespace-pre-wrap">{message.text}</div>}
        {attachments.length > 0 && (
          <div className={`mt-3 flex flex-col gap-2 ${hasText ? '' : 'mt-0'}`}>
            {attachments.map(renderAttachment)}
          </div>
        )}
        <div className={`text-[10px] mt-1 ${isUser ? 'text-indigo-100' : 'text-slate-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};
