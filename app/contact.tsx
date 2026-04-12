import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';

export default function ContactScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('my.menuContact') }} />
      <View style={styles.card}>
        <Text style={styles.desc}>{t('settings.contactDesc')}</Text>
        <Pressable style={styles.button} onPress={() => void Linking.openURL('mailto:support@localy.app')}>
          <Text style={styles.buttonText}>support@localy.app</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F9FAFB' },
  card: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 12,
  },
  desc: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  button: {
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  buttonText: { color: '#2F6BFF', fontWeight: '700', fontSize: 13 },
});

