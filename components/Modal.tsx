import React, { useEffect, memo, useCallback } from 'react';
import { useI18n } from '../src/i18n';
import { cn } from '../src/utils/cn';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = memo<ModalProps>(({ isOpen, onClose, title, children }) => {
  const { t } = useI18n();

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-primary/40 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in border border-border-subtle"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-background/50">
          <h3 id="modal-title" className="text-lg font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-background"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
});
Modal.displayName = 'Modal';
