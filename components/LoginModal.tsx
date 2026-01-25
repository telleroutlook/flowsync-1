import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useI18n } from '../src/i18n';

interface LoginModalProps {
  isOpen: boolean;
  error?: string | null;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<unknown> | void;
  onRegister: (username: string, password: string) => Promise<unknown> | void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  error,
  onClose,
  onLogin,
  onRegister,
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setMode('login');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(username.trim(), password);
      } else {
        await onRegister(username.trim(), password);
      }
      onClose();
    } catch {
      // keep modal open and rely on error message from parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'login' ? t('auth.login') : t('auth.register')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="auth-username" className="block text-sm font-medium text-slate-700 mb-1">
            {t('auth.username')}
          </label>
          <input
            ref={inputRef}
            id="auth-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
            placeholder={t('auth.username_placeholder')}
            required
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1">
            {t('auth.password')}
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
            placeholder={t('auth.password_placeholder')}
            required
          />
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {mode === 'login' ? t('auth.switch_to_register') : t('auth.switch_to_login')}
          </button>
          <span>{t('auth.password_hint')}</span>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-colors"
          >
            {t('common.close')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
