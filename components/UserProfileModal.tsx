import React, { memo, useCallback, useMemo } from 'react';
import type { User } from '../types';
import { useI18n } from '../src/i18n';
import { Modal } from './Modal';
import { cn } from '../src/utils/cn';
import { ChevronDown } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const UserProfileModal = memo<UserProfileModalProps>(({ isOpen, onClose, user }) => {
  const { t, locale, setLocale } = useI18n();

  const userInitial = useMemo(() => user ? user.username.charAt(0).toUpperCase() : '?', [user]);

  const handleLocaleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === 'en' || value === 'zh') setLocale(value);
  }, [setLocale]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('profile.title')}>
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-6 bg-background rounded-xl border border-border-subtle">
           <div className={cn(
             "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-sm mb-3",
             user ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-secondary/10 text-text-secondary"
           )}>
             {userInitial}
           </div>

           <div className="text-center">
             {user ? (
               <>
                 <h3 className="text-xl font-bold text-text-primary">{user.username}</h3>
                 <span className="inline-block mt-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success border border-success/20 text-xs font-bold uppercase tracking-wider">
                   {t('auth.signed_in')}
                 </span>
               </>
             ) : (
               <>
                 <h3 className="text-xl font-bold text-text-secondary">{t('auth.guest')}</h3>
                 <p className="text-sm text-text-secondary/60 mt-1 max-w-[200px]">{t('profile.guest_hint')}</p>
               </>
             )}
           </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wide" htmlFor="profile-language">
            {t('language.label')}
          </label>
          <div className="relative">
            <select
              id="profile-language"
              value={locale}
              onChange={handleLocaleChange}
              aria-label={t('language.switch')}
              className="w-full appearance-none rounded-lg border border-border-subtle bg-surface px-4 py-3 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all hover:border-primary/50 cursor-pointer"
            >
              <option value="en">🇺🇸 {t('language.english')}</option>
              <option value="zh">🇨🇳 {t('language.chinese')}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-text-secondary">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
});
UserProfileModal.displayName = 'UserProfileModal';
