import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SupportedLanguage } from '@/src/i18n';

export type LocalSettings = {
  notifyMatch: boolean;
  notifySubmission: boolean;
  notifyReaction: boolean;
  appLanguage: SupportedLanguage;
};

const KEY = 'localy_settings_v1';

const defaults: LocalSettings = {
  notifyMatch: true,
  notifySubmission: true,
  notifyReaction: true,
  appLanguage: 'en',
};

export async function getLocalSettings(): Promise<LocalSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export async function saveLocalSettings(next: LocalSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

