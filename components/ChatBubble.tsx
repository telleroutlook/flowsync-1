import React from 'react';
import { ChatMessage, ChatAttachment } from '../types';
import { Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../src/i18n';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const { t, locale } = useI18n();
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
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${ isUser
          ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
          : 'border-border-subtle bg-background text-text-primary hover:bg-gray-100'
      }`}
      rel="noreferrer"
    >
      <Paperclip className="w-3.5 h-3.5 opacity-70" />
      <div className="flex flex-col min-w-0">
        <span className="truncate font-medium">{attachment.name}</span>
        <span className={`text-[10px] ${isUser ? 'text-white/70' : 'text-text-secondary'}`}>
          {formatBytes(attachment.size)}
        </span>
      </div>
    </a>
  );

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 animate-fade-in">
        <span className="text-[10px] font-medium text-text-secondary bg-background px-3 py-1 rounded-full border border-border-subtle shadow-sm">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[92%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${ isUser
            ? 'bg-primary text-white rounded-br-none shadow-blue-100/50'
            : 'bg-surface text-text-primary border border-border-subtle rounded-bl-none shadow-sm'
        }`}
      >
        {hasText && (
          <div className={`markdown-content ${isUser ? 'text-white' : 'text-text-primary'}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-2 rounded-lg border border-inherit/20">
                    <table className="w-full text-left text-xs border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className={isUser ? "bg-white/10" : "bg-background"} {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className={`px-2 py-1.5 border-b font-semibold ${isUser ? "border-white/20" : "border-border-subtle text-text-secondary"}`} {...props} />
                ),
                tr: ({ node, ...props }) => (
                  <tr className={`border-b last:border-0 ${isUser ? "border-white/10 hover:bg-white/5" : "border-border-subtle hover:bg-background"}`} {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-2 py-1.5" {...props} />
                ),
                p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0 leading-relaxed" {...props} />,
                a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 opacity-90 hover:opacity-100 font-medium" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-1.5 space-y-0.5" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-1.5 space-y-0.5" {...props} />,
                li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className={`border-l-2 pl-3 my-1.5 italic ${isUser ? "border-white/40 text-white/90" : "border-primary/40 text-text-secondary"}`} {...props} />
                ),
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match && !String(children).includes('\n');
                  return isInline ? (
                    <code className={`px-1 py-0.5 rounded font-mono text-[0.9em] ${isUser ? "bg-white/20 border border-white/20" : "bg-background border border-border-subtle text-text-primary"}`} {...props}>
                      {children}
                    </code>
                  ) : (
                    <div className={`rounded-lg overflow-hidden my-2 border ${isUser ? "border-white/20 bg-black/20" : "border-border-subtle bg-background"}`}>
                      <div className={`text-[10px] px-3 py-1.5 font-mono opacity-80 border-b ${isUser ? "border-white/10 bg-white/5" : "border-border-subtle bg-gray-50 text-text-secondary"}`}>
                        {match ? match[1] : t('chat.code')}
                      </div>
                      <code className={`block p-3 overflow-x-auto font-mono text-xs ${isUser ? "text-white/90" : "text-text-primary"}`} {...props}>
                        {children}
                      </code>
                    </div>
                  )
                },
                pre: ({ node, ...props }) => {
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
        <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isUser ? 'text-white/70' : 'text-text-secondary/70'}`}>
          {new Date(message.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          {isUser && <span>• {t('chat.you')}</span>}
        </div>
      </div>
    </div>
  );
};
