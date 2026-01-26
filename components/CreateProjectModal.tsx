import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Modal } from './Modal';
import { useI18n } from '../src/i18n';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '../src/utils/cn';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export const CreateProjectModal = memo<CreateProjectModalProps>(({ isOpen, onClose, onCreate }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setName('');
        setDescription('');
        setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
    onClose();
  }, [name, description, onCreate, onClose]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleDescChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('project.create.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-text-secondary mb-1.5">
            {t('project.create.name')} <span className="text-critical">*</span>
          </label>
          <Input
            ref={inputRef}
            id="project-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder={t('project.create.placeholder_name')}
            required
          />
        </div>
        <div>
          <label htmlFor="project-desc" className="block text-sm font-medium text-text-secondary mb-1.5">
            {t('project.create.description')} <span className="text-xs text-text-secondary/60 font-normal">{t('project.create.optional')}</span>
          </label>
          <textarea
            id="project-desc"
            value={description}
            onChange={handleDescChange}
            className={cn(
              "flex min-h-[80px] w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm ring-offset-background placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            )}
            placeholder={t('project.create.placeholder_description')}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            {t('project.create.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={!name.trim()}
          >
            {t('project.create.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
});
CreateProjectModal.displayName = 'CreateProjectModal';
