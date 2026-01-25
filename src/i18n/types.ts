export type Locale = 'en' | 'zh';

export type InterpolationValues = Record<string, string | number>;

export type TFunction = (key: string, values?: InterpolationValues) => string;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}
