import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ko from './locales/ko/common.json';
import en from './locales/en/common.json';
import ja from './locales/ja/common.json';
import ptBR from './locales/pt-BR/common.json';

const supported = ['ko', 'en', 'ja', 'pt-BR'] as const;
export type SupportedLanguage = (typeof supported)[number];

function normalizeLocaleTag(tag: string): SupportedLanguage {
  // expo-localization may return tags like "pt-BR" or "pt_BR".
  const normalized = tag.replace('_', '-');
  if (normalized === 'pt-BR') return 'pt-BR';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ja')) return 'ja';
  return 'en';
}

export function getDefaultLanguage(): SupportedLanguage {
  const locale = Localization.getLocales()?.[0]?.languageTag ?? 'en';
  return normalizeLocaleTag(locale);
}

export function initI18n() {
  if (i18n.isInitialized) return i18n;

  i18n.use(initReactI18next).init({
    resources: {
      ko: { common: ko },
      en: { common: en },
      ja: { common: ja },
      'pt-BR': { common: ptBR },
    },
    lng: getDefaultLanguage(),
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

  return i18n;
}

export { i18n };
