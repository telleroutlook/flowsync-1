import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from './ChatInterface';
import { ChatAttachment, ChatMessage, Draft } from '../types';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '../src/i18n';

const baseMessages: ChatMessage[] = [
  { id: 'm1', role: 'user', text: 'Hi', timestamp: 1 },
];

const draft: Draft = {
  id: 'd1',
  projectId: 'p1',
  status: 'pending',
  createdAt: 1,
  createdBy: 'user',
  actions: [
    { id: 'a1', entityType: 'task', action: 'create', entityId: 't1' },
  ],
};

const attachments: ChatAttachment[] = [
  { id: 'f1', name: 'specs.pdf', size: 100, type: 'application/pdf', url: 'file://specs.pdf' },
];

describe('ChatInterface', () => {
  it('renders draft actions and handles apply/discard', async () => {
    const user = userEvent.setup();
    const onApplyDraft = vi.fn();
    const onDiscardDraft = vi.fn();

    render(
      <I18nProvider>
        <ChatInterface
          isChatOpen
          setIsChatOpen={vi.fn()}
          onResetChat={vi.fn()}
          pendingDraft={draft}
          draftWarnings={['Missing assignee']}
          onApplyDraft={onApplyDraft}
          onDiscardDraft={onDiscardDraft}
          messages={baseMessages}
          isProcessing={false}
          processingSteps={[]}
          thinkingPreview=""
          messagesEndRef={React.createRef()}
          onSendMessage={vi.fn()}
          pendingAttachments={attachments}
          onRemoveAttachment={vi.fn()}
          fileInputRef={React.createRef()}
          onAttachFiles={vi.fn()}
          inputText=""
          setInputText={vi.fn()}
        />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onApplyDraft).toHaveBeenCalledWith('d1');

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDiscardDraft).toHaveBeenCalledWith('d1');

    expect(screen.getByText(/Missing assignee/)).toBeInTheDocument();
  });

  it('enables submit when text exists and calls onSendMessage', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    const { container, rerender } = render(
      <I18nProvider>
        <ChatInterface
          isChatOpen
          setIsChatOpen={vi.fn()}
          onResetChat={vi.fn()}
          pendingDraft={null}
          draftWarnings={[]}
          onApplyDraft={vi.fn()}
          onDiscardDraft={vi.fn()}
          messages={baseMessages}
          isProcessing={false}
          processingSteps={[]}
          thinkingPreview=""
          messagesEndRef={React.createRef()}
          onSendMessage={onSendMessage}
          pendingAttachments={[]}
          onRemoveAttachment={vi.fn()}
          fileInputRef={React.createRef()}
          onAttachFiles={vi.fn()}
          inputText=""
          setInputText={vi.fn()}
        />
      </I18nProvider>
    );

    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();

    rerender(
      <I18nProvider>
        <ChatInterface
          isChatOpen
          setIsChatOpen={vi.fn()}
          onResetChat={vi.fn()}
          pendingDraft={null}
          draftWarnings={[]}
          onApplyDraft={vi.fn()}
          onDiscardDraft={vi.fn()}
          messages={baseMessages}
          isProcessing={false}
          processingSteps={[]}
          thinkingPreview=""
          messagesEndRef={React.createRef()}
          onSendMessage={onSendMessage}
          pendingAttachments={[]}
          onRemoveAttachment={vi.fn()}
          fileInputRef={React.createRef()}
          onAttachFiles={vi.fn()}
          inputText="Hello"
          setInputText={vi.fn()}
        />
      </I18nProvider>
    );

    const submitButtonAfter = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButtonAfter).not.toBeDisabled();

    const form = container.querySelector('form');
    if (!form) throw new Error('Form not found');
    fireEvent.submit(form);
    expect(onSendMessage).toHaveBeenCalled();
  });
});
