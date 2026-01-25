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
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800">
          {mode === 'login' ? t('auth.login_welcome') : t('auth.create_account')}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'login' ? t('auth.login_desc') : t('auth.register_desc')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              {t('auth.username')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <input
                ref={inputRef}
                id="auth-username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm shadow-sm"
                placeholder={t('auth.username_placeholder')}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              {t('auth.password')}
            </label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               </div>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm shadow-sm"
                placeholder={t('auth.password_placeholder')}
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        <div className="mt-2">
          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
            className="w-full px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isSubmitting ? t('common.processing') : (mode === 'login' ? t('auth.login') : t('auth.register'))}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mt-2">
           <span>{mode === 'login' ? t('auth.no_account') : t('auth.have_account')}</span>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
          >
            {mode === 'login' ? t('auth.register_now') : t('auth.login_now')}
          </button>
        </div>
      </form>
    </Modal>
  );
};