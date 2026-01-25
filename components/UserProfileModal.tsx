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
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600">
            {user ? t('auth.signed_in_as', { name: user.username }) : t('auth.guest')}
          </p>
          {!user && (
            <p className="text-[11px] text-slate-400 mt-1">{t('profile.guest_hint')}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600" htmlFor="profile-language">
            {t('language.label')}
          </label>
          <select
            id="profile-language"
            value={locale}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'en' || value === 'zh') setLocale(value);
            }}
            aria-label={t('language.switch')}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="en">{t('language.english')}</option>
            <option value="zh">{t('language.chinese')}</option>
          </select>
        </div>
      </div>
    </Modal>
  );
};
