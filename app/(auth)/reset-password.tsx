import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { isValidPasswordLength, PASSWORD_MIN_LENGTH, updatePassword } from '@/src/features/auth/password';
import { supabase } from '@/src/lib/supabase/client';

const CTA_GOLD = '#D4A017';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => isValidPasswordLength(password) && password === confirmPassword,
    [password, confirmPassword],
  );

  async function signOutNonBlocking() {
    // signOut이 네트워크 상태에 따라 오래 걸릴 수 있어 UI 성공 표시를 막지 않도록 제한 시간만 기다린다.
    await Promise.race([
      supabase.auth.signOut(),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]).catch(() => {});
  }

  async function onReset() {
    if (!isValidPasswordLength(password)) {
      setErrorText(t('auth.passwordTooShort', { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (password !== confirmPassword) {
      setErrorText(t('settings.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    setErrorText(null);
    try {
      const res = await updatePassword(password, emailParam);
      if (res.error) {
        setErrorText(`${t('settings.passwordChangeFailed')} (${res.error.message})`);
        return;
      }

      await signOutNonBlocking();

      Alert.alert('', t('settings.passwordChangeSuccess'), [
        {
          text: t('auth.verify'),
          onPress: () => router.replace('/(auth)/email' as any),
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      setErrorText(`${t('settings.passwordChangeFailed')} (${message})`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>
        <Text style={styles.hint}>{t('auth.resetPasswordHint')}</Text>

        <TextField
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errorText) setErrorText(null);
          }}
          placeholder={t('settings.newPassword')}
          secureTextEntry
          enablePasswordToggle
          autoCapitalize="none"
          inputStyle={styles.authInput}
        />

        <TextField
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            if (errorText) setErrorText(null);
          }}
          placeholder={t('settings.confirmPassword')}
          secureTextEntry
          enablePasswordToggle
          autoCapitalize="none"
          inputStyle={styles.authInput}
          errorText={
            confirmPassword.length > 0 && password !== confirmPassword
              ? t('settings.passwordMismatch')
              : undefined
          }
        />

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <Button
          label={t('auth.resetPasswordSubmit')}
          onPress={() => void onReset()}
          disabled={!canSubmit || submitting}
          loading={submitting}
          style={styles.ctaGold}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#111827',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#4B5563',
    fontWeight: '600',
    marginBottom: 4,
  },
  authInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },
  ctaGold: { backgroundColor: CTA_GOLD },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
});
