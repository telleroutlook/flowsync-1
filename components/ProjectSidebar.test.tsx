import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectSidebar } from './ProjectSidebar';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '../src/i18n';

const projects = [
  { id: 'p1', name: 'Alpha', description: 'First' },
  { id: 'p2', name: 'Beta', description: 'Second' },
];

describe('ProjectSidebar', () => {
  it('handles select, create, delete, and close actions', async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();
    const onCreateProject = vi.fn();
    const onDeleteProject = vi.fn();
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <I18nProvider>
        <ProjectSidebar
          projects={projects}
          activeProjectId="p1"
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
          onClose={onClose}
        />
      </I18nProvider>
    );

    await user.click(screen.getByText('Beta'));
    expect(onSelectProject).toHaveBeenCalledWith('p2');

    await user.click(screen.getByTitle('Create New Project'));
    expect(onCreateProject).toHaveBeenCalledTimes(1);
    
    await user.click(screen.getByTitle('Collapse Sidebar'));
    expect(onClose).toHaveBeenCalledTimes(1);

    const deleteButtons = screen.getAllByTitle('Delete Project');
    await user.click(deleteButtons[1]);
    expect(onDeleteProject).toHaveBeenCalledWith('p2');

    confirmSpy.mockRestore();
  });
});
