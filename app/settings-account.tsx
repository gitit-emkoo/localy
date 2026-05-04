import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { changePasswordWithCurrent, isValidPasswordLength, PASSWORD_MIN_LENGTH } from '@/src/features/auth/password';
import { supabase } from '@/src/lib/supabase/client';

export default function AccountSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErrorText, setPwErrorText] = useState<string | null>(null);

  const loadEmail = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setLoginEmail(data.user?.email ?? null);
  }, []);

  useEffect(() => {
    void loadEmail();
  }, [loadEmail]);

  async function logout() {
    Alert.alert(t('my.logoutTitle'), t('my.logoutBody'), [
      { text: t('my.logoutCancel'), style: 'cancel' },
      {
        text: t('my.logoutConfirm'),
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  async function onChangePassword() {
    if (!loginEmail) {
      setPwErrorText(t('settings.passwordChangeFailed'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErrorText(t('settings.passwordMismatch'));
      return;
    }
    if (!isValidPasswordLength(newPassword)) {
      setPwErrorText(t('auth.passwordTooShort', { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    setPwLoading(true);
    setPwErrorText(null);
    try {
      const res = await changePasswordWithCurrent(loginEmail, currentPassword, newPassword);
      if (res.error) {
        setPwErrorText(`${t('settings.passwordChangeFailed')} (${res.error.message})`);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
      Alert.alert('', t('settings.passwordChangeSuccess'), [
        {
          text: t('auth.verify'),
          onPress: () => router.replace('/(auth)/email' as any),
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      setPwErrorText(`${t('settings.passwordChangeFailed')} (${message})`);
    } finally {
      setPwLoading(false);
    }
  }

  const canSubmitPw =
    currentPassword.length > 0 && isValidPasswordLength(newPassword) && newPassword === confirmPassword;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: t('my.menuAccount') }} />

      <View style={styles.card}>
        <Text style={styles.desc}>{t('settings.accountDesc')}</Text>

        <Text style={styles.label}>{t('settings.accountEmailLabel')}</Text>
        <Text style={styles.emailValue}>{loginEmail ?? '—'}</Text>

        <Text style={styles.sectionTitle}>{t('settings.accountPasswordTitle')}</Text>
        <TextField
          value={currentPassword}
          onChangeText={(v) => {
            setCurrentPassword(v);
            if (pwErrorText) setPwErrorText(null);
          }}
          placeholder={t('settings.currentPassword')}
          secureTextEntry
          enablePasswordToggle
          autoCapitalize="none"
        />
        <TextField
          value={newPassword}
          onChangeText={(v) => {
            setNewPassword(v);
            if (pwErrorText) setPwErrorText(null);
          }}
          placeholder={t('settings.newPassword')}
          secureTextEntry
          enablePasswordToggle
          autoCapitalize="none"
        />
        <TextField
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            if (pwErrorText) setPwErrorText(null);
          }}
          placeholder={t('settings.confirmPassword')}
          secureTextEntry
          enablePasswordToggle
          autoCapitalize="none"
          errorText={confirmPassword.length > 0 && newPassword !== confirmPassword ? t('settings.passwordMismatch') : undefined}
        />
        {pwErrorText ? <Text style={styles.error}>{pwErrorText}</Text> : null}
        <Button
          label={t('settings.changePassword')}
          variant="secondary"
          onPress={() => void onChangePassword()}
          disabled={!canSubmitPw}
          loading={pwLoading}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('settings.withdrawTitle')}</Text>
        <Text style={styles.desc}>{t('settings.withdrawDesc')}</Text>
        <Button
          label={t('settings.withdrawCta')}
          variant="secondary"
          onPress={() => router.push('/contact' as any)}
        />
      </View>

      <View style={styles.card}>
        <Pressable style={styles.logoutButton} onPress={() => void logout()}>
          <Text style={styles.logoutText}>{t('my.logout')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  card: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 12,
  },
  desc: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  emailValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  error: {
    color: '#D92D20',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutText: { fontSize: 14, fontWeight: '700' },
});
