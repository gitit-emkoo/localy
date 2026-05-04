import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { verifyEmailOtp } from '@/src/features/auth/otp';

const CTA_GOLD = '#D4A017';

export default function VerifyResetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = Array.isArray(params.email) ? params.email[0] : params.email;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canVerify = useMemo(() => code.trim().length === 6, [code]);

  async function onVerify() {
    const e = String(email ?? '').trim();
    const token = code.trim();

    if (!e || token.length !== 6) {
      setErrorText(t('auth.invalidCode'));
      return;
    }

    setLoading(true);
    setErrorText(null);
    const res = await verifyEmailOtp(e, token);
    setLoading(false);
    if (res.error) {
      console.warn('[verify-reset][verifyEmailOtp]', res.error.message);
      setErrorText(`${t('auth.invalidCode')} (${res.error.message})`);
      return;
    }

    router.replace({
      pathname: '/(auth)/reset-password' as any,
      params: { email: e },
    });
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      enableOnAndroid
      enableAutomaticScroll
      extraScrollHeight={Platform.OS === 'android' ? 120 : 48}
      extraHeight={Platform.OS === 'android' ? 24 : 12}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.resetCodeTitle')}</Text>
        <Text style={styles.hint}>{t('auth.resetCodeHint')}</Text>

        <TextField
          value={code}
          onChangeText={(v: string) => {
            const onlyDigits = v.replace(/\D+/g, '').slice(0, 6);
            setCode(onlyDigits);
            if (errorText) setErrorText(null);
          }}
          placeholder={t('auth.codePlaceholder')}
          keyboardType="number-pad"
          autoCapitalize="none"
          maxLength={6}
          inputStyle={styles.authInput}
        />

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <Button
          label={t('auth.verify')}
          onPress={() => void onVerify()}
          disabled={!canVerify}
          loading={loading}
          style={styles.ctaGold}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 16,
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
  ctaGold: {
    backgroundColor: CTA_GOLD,
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
});
