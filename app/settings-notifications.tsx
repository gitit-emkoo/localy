import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { getLocalSettings, saveLocalSettings, type LocalSettings } from '@/src/features/settings/localSettings';

export default function NotificationSettingsScreen() {
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

  async function update<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveLocalSettings(next);
  }

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t('my.menuNotif') }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('my.menuNotif') }} />
      <Row
        title={t('settings.notifyMatch')}
        desc={t('settings.notifyMatchDesc')}
        value={settings.notifyMatch}
        onChange={(v) => void update('notifyMatch', v)}
      />
      <Row
        title={t('settings.notifySubmission')}
        desc={t('settings.notifySubmissionDesc')}
        value={settings.notifySubmission}
        onChange={(v) => void update('notifySubmission', v)}
      />
      <Row
        title={t('settings.notifyReaction')}
        desc={t('settings.notifyReactionDesc')}
        value={settings.notifyReaction}
        onChange={(v) => void update('notifyReaction', v)}
      />
    </View>
  );
}

function Row(props: { title: string; desc: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.desc}>{props.desc}</Text>
      </View>
      <Switch value={props.value} onValueChange={props.onChange} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, color: '#6B7280' },
});

