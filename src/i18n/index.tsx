import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';
import type { I18nContextValue, InterpolationValues, Locale } from './types';

const STORAGE_KEY = 'flowsync:locale';
const DEFAULT_LOCALE: Locale = 'en';

const normalizeLocale = (value: string | null | undefined): Locale => {
  if (!value) return DEFAULT_LOCALE;
  return value.toLowerCase().startsWith('zh') ? 'zh' : 'en';
};

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  return normalizeLocale(window.navigator.language);
};

const I18nContext = createContext<I18nContextValue | null>(null);

const interpolate = (template: string, values?: InterpolationValues) => {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const t = useCallback((key: string, values?: InterpolationValues) => {
    const dict = translations[locale] || translations.en;
    const fallback = translations.en[key as keyof typeof translations.en];
    const template = dict[key] ?? fallback ?? key;
    return interpolate(template, values);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t,
  }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
