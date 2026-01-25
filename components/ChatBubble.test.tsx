import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatBubble } from './ChatBubble';
import { ChatMessage } from '../types';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '../src/i18n';

// Mock dependencies
vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en-US'
  }),
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-markdown to avoid complex parsing in tests
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('ChatBubble', () => {
  it('renders system messages with correct styling', () => {
    const systemMessage: ChatMessage = {
      id: 's1',
      role: 'system',
      text: 'System notification',
      timestamp: Date.now(),
    };

    const { container } = render(
      <I18nProvider>
        <ChatBubble message={systemMessage} />
      </I18nProvider>
    );

    // Check for the text
    expect(screen.getByText('System notification')).toBeInTheDocument();

    // Check for the updated class name
    const bubble = container.querySelector('.rounded-lg');
    expect(bubble).toBeInTheDocument();
    
    // Ensure rounded-full is NOT present on the message container (it might be on other elements if any)
    // The specific bubble container should have rounded-lg and max-w-[85%]
    const messageContainer = screen.getByText('System notification').closest('div');
    expect(messageContainer).toHaveClass('rounded-lg');
    expect(messageContainer).toHaveClass('max-w-[85%]');
    expect(messageContainer).not.toHaveClass('rounded-full');
  });

  it('renders user messages with correct styling', () => {
    const userMessage: ChatMessage = {
      id: 'u1',
      role: 'user',
      text: 'User message',
      timestamp: Date.now(),
    };

    const { container } = render(
      <I18nProvider>
        <ChatBubble message={userMessage} />
      </I18nProvider>
    );

    expect(screen.getByText('User message')).toBeInTheDocument();
    // closest('div') is the mock wrapper, parent is markdown-content, parent's parent is the bubble
    const messageContainer = screen.getByText('User message').closest('div')?.parentElement?.parentElement;
    // User messages use rounded-2xl
    expect(messageContainer).toHaveClass('rounded-2xl');
  });
});
