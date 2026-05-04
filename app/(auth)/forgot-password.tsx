import { useMemo, useState } from 'react';
import { ImageBackground, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { requestPasswordResetOtp } from '@/src/features/auth/otp';

const CTA_GOLD = '#D4A017';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const formTopPadding = insets.top + Math.round(windowHeight * 0.38);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const canSubmit = useMemo(() => isValidEmail(email), [email]);

  async function onSendReset() {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setErrorText(t('auth.invalidEmail'));
      return;
    }
    setSubmitting(true);
    setErrorText(null);

    const res = await requestPasswordResetOtp(trimmed);
    setSubmitting(false);
    if (res.error) {
      console.warn('[forgot-password][requestPasswordResetOtp]', res.error.message);
      setErrorText(`${t('auth.requestFailed')} (${res.error.message})`);
      return;
    }

    router.push({
      pathname: '/(auth)/verify-reset' as any,
      params: { email: trimmed, flow: 'reset' },
    });
  }

  return (
    <ImageBackground source={require('../../assets/login.png')} style={styles.bg} resizeMode="cover">
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: formTopPadding,
            paddingBottom: Math.max(insets.bottom, 16) + 36,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={Platform.OS === 'android' ? 140 : 56}
        extraHeight={Platform.OS === 'android' ? 32 : 16}
        showsVerticalScrollIndicator={false}>
        <View style={styles.formBlock}>
          <Text style={styles.title}>{t('auth.forgotPassword')}</Text>
          <Text style={styles.tagline}>{t('auth.forgotPasswordHint')}</Text>

          <TextField
            value={email}
            onChangeText={(v: string) => {
              setEmail(v);
              if (errorText) setErrorText(null);
            }}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            inputStyle={styles.authInput}
          />

          {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

          <Button
            label={t('auth.sendResetCode')}
            onPress={() => void onSendReset()}
            disabled={!canSubmit || submitting}
            loading={submitting}
            style={styles.ctaGold}
          />
          <Button
            label={t('auth.backToLogin')}
            onPress={() => router.replace('/(auth)/email' as any)}
            variant="secondary"
            disabled={submitting}
          />
        </View>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    gap: 14,
  },
  formBlock: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    padding: 18,
  },
  authInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#111827',
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  ctaGold: { backgroundColor: CTA_GOLD },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
});
