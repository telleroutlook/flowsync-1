import React from 'react';
import { ChatAttachment, ChatMessage } from '../types';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[92%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed shadow-sm transition-all ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-100'
            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-slate-100'
        }`}
      >
        {hasText && (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-2 rounded-lg border border-inherit/20">
                    <table className="w-full text-left text-xs border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className={isUser ? "bg-indigo-700/50" : "bg-slate-50"} {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className={`px-2 py-1.5 border-b font-semibold ${isUser ? "border-indigo-400/30" : "border-slate-200 text-slate-700"}`} {...props} />
                ),
                tr: ({ node, ...props }) => (
                  <tr className={`border-b last:border-0 ${isUser ? "border-indigo-400/20 hover:bg-indigo-700/30" : "border-slate-100 hover:bg-slate-50"}`} {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-2 py-1.5" {...props} />
                ),
                p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0 leading-relaxed" {...props} />,
                a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 opacity-90 hover:opacity-100" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-1.5 space-y-0.5" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-1.5 space-y-0.5" {...props} />,
                li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className={`border-l-2 pl-3 my-1.5 italic ${isUser ? "border-indigo-300/50" : "border-slate-300 text-slate-500"}`} {...props} />
                ),
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match && !String(children).includes('\n');
                  return isInline ? (
                    <code className={`px-1 py-0.5 rounded font-mono text-[0.9em] ${isUser ? "bg-indigo-800/50 border border-indigo-400/30" : "bg-slate-100 border border-slate-200 text-slate-700"}`} {...props}>
                      {children}
                    </code>
                  ) : (
                    <div className={`rounded-lg overflow-hidden my-2 border ${isUser ? "border-indigo-400/30 bg-indigo-800/50" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] px-2 py-1 font-mono opacity-70 border-b ${isUser ? "border-indigo-400/30" : "border-slate-200"}`}>
                        {match ? match[1] : 'code'}
                      </div>
                      <code className={`block p-2 overflow-x-auto font-mono text-xs ${isUser ? "" : "text-slate-700"}`} {...props}>
                        {children}
                      </code>
                    </div>
                  )
                },
                pre: ({ node, ...props }) => {
                  // Destructure ref to avoid passing HTMLPreElement ref to HTMLDivElement
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { ref, ...rest } = props as any; 
                  return <div className="not-prose" {...rest} />;
                },
              }}
            >
              {message.text}
            </ReactMarkdown>
          </div>
        )}
        {attachments.length > 0 && (
          <div className={`mt-2 flex flex-col gap-1.5 ${hasText ? '' : 'mt-0'}`}>
            {attachments.map(renderAttachment)}
          </div>
        )}
        <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 opacity-70`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isUser && <span>• You</span>}
        </div>
      </div>
    </div>
  );
};
