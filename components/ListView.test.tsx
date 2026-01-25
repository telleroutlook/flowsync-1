import React from 'react';
import { render, screen } from '@testing-library/react';
import { ListView } from './ListView';
import { Priority, TaskStatus, Task } from '../types';
import { describe, it, expect } from 'vitest';
import { I18nProvider } from '../src/i18n';

const baseTask = (overrides: Partial<Task>): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'Task',
  status: TaskStatus.TODO,
  priority: Priority.MEDIUM,
  createdAt: 1,
  ...overrides,
});

describe('ListView', () => {
  it('shows empty state when no tasks', () => {
    render(
      <I18nProvider>
        <ListView tasks={[]} />
      </I18nProvider>
    );
    expect(screen.getByText('No tasks in this list')).toBeInTheDocument();
  });

  it('sorts tasks by WBS with numeric order', () => {
    const tasks: Task[] = [
      baseTask({ id: 't1', wbs: '1.10', title: 'Later' }),
      baseTask({ id: 't2', wbs: '1.2', title: 'Sooner' }),
      baseTask({ id: 't3', wbs: '2.1', title: 'Last' }),
    ];

    render(
      <I18nProvider>
        <ListView tasks={tasks} />
      </I18nProvider>
    );

    const first = screen.getByText('1.2');
    const second = screen.getByText('1.10');
    const third = screen.getByText('2.1');

    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(second.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
