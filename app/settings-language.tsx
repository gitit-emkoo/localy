import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { getLocalSettings, saveLocalSettings, type LocalSettings } from '@/src/features/settings/localSettings';
import { i18n, type SupportedLanguage } from '@/src/i18n';

const options: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
];

export default function LanguageSettingsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LocalSettings | null>(null);

  const load = useCallback(async () => {
    const s = await getLocalSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  async function onSelect(lang: SupportedLanguage) {
    if (!settings) return;
    const next = { ...settings, appLanguage: lang };
    setSettings(next);
    await saveLocalSettings(next);
    await i18n.changeLanguage(lang);
  }

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t('my.menuLanguage') }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('my.menuLanguage') }} />
      {options.map((o) => {
        const active = settings.appLanguage === o.code;
        return (
          <Pressable
            key={o.code}
            style={[styles.row, active ? styles.rowActive : null]}
            onPress={() => void onSelect(o.code)}>
            <Text style={[styles.title, active ? styles.titleActive : null]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 16, gap: 10, backgroundColor: '#F9FAFB' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  rowActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2F6BFF',
  },
  title: { fontSize: 14, fontWeight: '700' },
  titleActive: { color: '#2F6BFF' },
});

