import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Modal } from './Modal';
import { useI18n } from '../src/i18n';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '../src/utils/cn';
import { User, Lock, AlertCircle, LogIn, UserPlus } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  error?: string | null;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<unknown> | void;
  onRegister: (username: string, password: string) => Promise<unknown> | void;
}

export const LoginModal = memo<LoginModalProps>(({
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

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
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
  }, [username, password, mode, onLogin, onRegister, onClose]);

  const handleUsernameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  }, []);

  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'login' ? 'register' : 'login');
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm ring-1 ring-primary/20">
          {mode === 'login' ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
        </div>
        <h3 className="text-xl font-bold text-text-primary">
          {mode === 'login' ? t('auth.login_welcome') : t('auth.create_account')}
        </h3>
        <p className="text-sm text-text-secondary mt-1">
          {mode === 'login' ? t('auth.login_desc') : t('auth.register_desc')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wide">
              {t('auth.username')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary/50">
                 <User className="w-4 h-4" />
              </div>
              <Input
                ref={inputRef}
                id="auth-username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className="pl-9"
                placeholder={t('auth.username_placeholder')}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wide">
              {t('auth.password')}
            </label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary/50">
                 <Lock className="w-4 h-4" />
               </div>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className="pl-9"
                placeholder={t('auth.password_placeholder')}
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-negative/20 bg-negative/10 px-3 py-2.5 text-xs font-medium text-negative flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-2">
          <Button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
            isLoading={isSubmitting}
            className="w-full font-bold shadow-md hover:shadow-lg transition-all"
          >
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1 text-xs text-text-secondary mt-2">
           <span>{mode === 'login' ? t('auth.no_account') : t('auth.have_account')}</span>
          <button
            type="button"
            onClick={toggleMode}
            className="font-bold text-primary hover:text-primary-hover hover:underline transition-all"
          >
            {mode === 'login' ? t('auth.register_now') : t('auth.login_now')}
          </button>
        </div>
      </form>
    </Modal>
  );
});
LoginModal.displayName = 'LoginModal';
