import { useMemo, useState } from 'react';
import { ImageBackground, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@/src/i18n';
import { requestEmailOtp } from '@/src/features/auth/otp';
import { isValidPasswordLength, PASSWORD_MIN_LENGTH } from '@/src/features/auth/password';
import { useSignupDraftStore } from '@/src/stores/useSignupDraftStore';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';

initI18n();

const CTA_GOLD = '#D4A017';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function SignupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const setSignupDraft = useSignupDraftStore((s) => s.setDraft);
  const formTopPadding = insets.top + Math.round(windowHeight * 0.38);
  const clearSignupDraft = useSignupDraftStore((s) => s.clearDraft);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [emailFormatWarning, setEmailFormatWarning] = useState(false);

  function clearEmailFormatWarningIfOk(nextEmail: string) {
    const trimmed = nextEmail.trim();
    if (trimmed.length === 0 || isValidEmail(nextEmail)) {
      setEmailFormatWarning(false);
    }
  }

  const canSendCode = useMemo(
    () => isValidEmail(email) && isValidPasswordLength(password),
    [email, password],
  );

  async function onSendCode() {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setErrorText(t('auth.invalidEmail'));
      return;
    }
    if (!isValidPasswordLength(password)) {
      setErrorText(t('auth.passwordTooShort', { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    setSignupDraft({ email: trimmedEmail, password });
    const res = await requestEmailOtp(trimmedEmail);
    setSubmitting(false);
    if (res.error) {
      clearSignupDraft();
      setErrorText(t('auth.requestFailed'));
      return;
    }
    router.push({
      pathname: '/(auth)/verify' as any,
      params: { email: trimmedEmail, flow: 'signup' },
    });
  }

  return (
    <ImageBackground
      source={require('../../assets/login.png')}
      style={styles.bg}
      resizeMode="cover">
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
            <Text style={styles.title}>{t('auth.signupHeading')}</Text>

            <TextField
              value={email}
              onChangeText={(v: string) => {
                setEmail(v);
                if (errorText) setErrorText(null);
                clearEmailFormatWarningIfOk(v);
              }}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              errorText={emailFormatWarning ? t('auth.invalidEmail') : undefined}
              onBlur={() => {
                const trimmed = email.trim();
                if (trimmed.length > 0) setEmailFormatWarning(!isValidEmail(email));
              }}
              inputStyle={styles.authInput}
            />

            <TextField
              value={password}
              onChangeText={(v: string) => {
                setPassword(v);
                if (errorText) setErrorText(null);
              }}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry
              autoCapitalize="none"
              onFocus={() => {
                const trimmed = email.trim();
                if (trimmed.length > 0) setEmailFormatWarning(!isValidEmail(email));
              }}
              inputStyle={styles.authInput}
            />

            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

            <Button
              label={t('auth.signupSendCode')}
              onPress={() => void onSendCode()}
              disabled={!canSendCode || submitting}
              loading={submitting}
              style={styles.ctaGold}
            />

            <Pressable
              onPress={() => router.replace('/(auth)/email' as any)}
              style={({ pressed }) => [styles.loginLinkWrap, pressed ? styles.loginLinkPressed : null]}>
              <Text style={styles.loginLink}>{t('auth.alreadyHaveAccount')}</Text>
            </Pressable>
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
    marginBottom: 4,
    textAlign: 'center',
    color: '#111827',
  },
  ctaGold: { backgroundColor: CTA_GOLD },
  loginLinkWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  loginLinkPressed: { opacity: 0.7 },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: CTA_GOLD,
    textDecorationLine: 'underline',
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
});
