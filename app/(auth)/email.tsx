import { useMemo, useState } from 'react';
import { ImageBackground, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@/src/i18n';
import { useSignupDraftStore } from '@/src/stores/useSignupDraftStore';
import { supabase } from '@/src/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';

initI18n();

/** 홈 오늘의 미션 CTA와 동일 */
const CTA_GOLD = '#D4A017';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

type Pending = 'idle' | 'login';

export default function EmailAuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const clearSignupDraft = useSignupDraftStore((s) => s.clearDraft);
  const formTopPadding = insets.top + Math.round(windowHeight * 0.38);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<Pending>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  /** 이메일 칸 blur 또는 비밀번호 칸 focus 시, 비어 있지 않은데 형식이 틀리면 표시 */
  const [emailFormatWarning, setEmailFormatWarning] = useState(false);
  const busy = pending !== 'idle';

  function clearEmailFormatWarningIfOk(nextEmail: string) {
    const t = nextEmail.trim();
    if (t.length === 0 || isValidEmail(nextEmail)) {
      setEmailFormatWarning(false);
    }
  }

  /** 로그인은 이메일 형식 + 비밀번호만 입력되면 시도 가능(길이는 서버/오류로 확인). */
  const canProceedLogin = useMemo(
    () => isValidEmail(email) && password.length > 0,
    [email, password],
  );

  async function onLogin() {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail) || password.length === 0) {
      setErrorText(t('auth.invalidCredentials'));
      return;
    }
    setPending('login');
    setErrorText(null);
    clearSignupDraft();
    const res = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    setPending('idle');
    if (res.error) {
      setErrorText(t('auth.invalidCredentials'));
      return;
    }
    router.replace('/(tabs)' as any);
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
          <Text style={styles.title}>{t('auth.loginHeading')}</Text>

          <Text style={styles.tagline}>{t('auth.emailScreenTagline')}</Text>

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
              const t = email.trim();
              if (t.length > 0) setEmailFormatWarning(!isValidEmail(email));
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
              const t = email.trim();
              if (t.length > 0) setEmailFormatWarning(!isValidEmail(email));
            }}
            inputStyle={styles.authInput}
          />

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <Button
          label={t('auth.loginSubmit')}
          onPress={() => void onLogin()}
          disabled={!canProceedLogin || busy}
          loading={pending === 'login'}
          style={styles.ctaGold}
        />

        <Button
          label={t('auth.signupWithEmail')}
          onPress={() => router.push('/(auth)/signup' as any)}
          disabled={busy}
          style={styles.ctaGold}
        />
          </View>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
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
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 4,
  },
  ctaGold: {
    backgroundColor: CTA_GOLD,
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
});
