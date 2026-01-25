import React from 'react';
import type { User } from '../types';
import { useI18n } from '../src/i18n';
import { Modal } from './Modal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user }) => {
  const { t, locale, setLocale } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('profile.title')}>
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl border border-slate-100">
           <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-sm mb-3 ${
             user ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'
           }`}>
             {user ? user.username.charAt(0).toUpperCase() : '?'}
           </div>
           
           <div className="text-center">
             {user ? (
               <>
                 <h3 className="text-lg font-bold text-slate-800">{user.username}</h3>
                 <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                   {t('auth.signed_in')}
                 </span>
               </>
             ) : (
               <>
                 <h3 className="text-lg font-bold text-slate-400">{t('auth.guest')}</h3>
                 <p className="text-xs text-slate-400 mt-1 max-w-[200px]">{t('profile.guest_hint')}</p>
               </>
             )}
           </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide" htmlFor="profile-language">
            {t('language.label')}
          </label>
          <div className="relative">
            <select
              id="profile-language"
              value={locale}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'en' || value === 'zh') setLocale(value);
              }}
              aria-label={t('language.switch')}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all hover:border-indigo-300 cursor-pointer"
            >
              <option value="en">🇺🇸 {t('language.english')}</option>
              <option value="zh">🇨🇳 {t('language.chinese')}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};