import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@/src/i18n';
import {
  INTRO_MAX,
  INTEREST_OPTIONS,
  MVP_COUNTRIES,
  NICKNAME_MAX,
  NICKNAME_MIN,
  SHORT_BIO_MAX,
  type InterestKey,
} from '@/src/constants/profile';
import { setupProfile } from '@/src/features/profile/setupProfile';
import { useAuthStore } from '@/src/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';

initI18n();

const CTA_GOLD = '#D4A017';

const authInput = {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#000',
} as const;

const AGE_OPTIONS = Array.from({ length: 83 }, (_, i) => i + 18); // 18~100

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const setProfilePhase = useAuthStore((s) => s.setProfilePhase);

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState<number>(32);
  const [countryCode, setCountryCode] = useState(MVP_COUNTRIES[0].code);
  const [shortBio, setShortBio] = useState('');
  const [intro, setIntro] = useState('');
  const [interests, setInterests] = useState<InterestKey[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const countryName = useMemo(() => {
    const found = MVP_COUNTRIES.find((c) => c.code === countryCode);
    return found ? t(found.nameKey) : t('country.KR');
  }, [countryCode, t]);

  const isNicknameValid = nickname.trim().length >= NICKNAME_MIN && nickname.trim().length <= NICKNAME_MAX;
  const isShortBioValid = shortBio.trim().length > 0 && shortBio.trim().length <= SHORT_BIO_MAX;
  const hasInterests = interests.length >= 1;

  const canStart = isNicknameValid && isShortBioValid && hasInterests && Boolean(age) && Boolean(countryCode);

  function toggleInterest(key: InterestKey) {
    setInterests((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  async function onStart() {
    if (!canStart) {
      setErrorText(t('profile.required'));
      return;
    }

    setLoading(true);
    setErrorText(null);

    const res = await setupProfile({
      nickname: nickname.trim(),
      age,
      countryCode,
      countryName,
      shortBio: shortBio.trim(),
      intro: intro.trim() ? intro.trim() : undefined,
      interests,
    });

    setLoading(false);

    if (res.error) {
      setErrorText(t('profile.saveFailed'));
      return;
    }

    setProfilePhase('profile_completed');
    router.replace('/(tabs)' as any);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('profile.subtitle')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.nickname')}</Text>
        <TextField
          value={nickname}
          onChangeText={(v: string) => setNickname(v)}
          placeholder={t('profile.nickname')}
          autoCapitalize="none"
          maxLength={NICKNAME_MAX}
          inputStyle={authInput}
        />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>{t('profile.age')}</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={age} onValueChange={(v: unknown) => setAge(Number(v))}>
                {AGE_OPTIONS.map((a) => (
                  <Picker.Item key={a} label={`${a}`} value={a} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>{t('profile.country')}</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={countryCode} onValueChange={(v: unknown) => setCountryCode(String(v) as any)}>
                {MVP_COUNTRIES.map((c) => (
                  <Picker.Item key={c.code} label={t(c.nameKey)} value={c.code} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('profile.shortBio')}</Text>
        <TextField
          value={shortBio}
          onChangeText={setShortBio}
          placeholder={t('profile.shortBio')}
          maxLength={SHORT_BIO_MAX}
          autoCapitalize="sentences"
          inputStyle={authInput}
        />

        <Text style={styles.sectionTitle}>{t('profile.intro')}</Text>
        <TextField
          value={intro}
          onChangeText={setIntro}
          placeholder={t('profile.intro')}
          maxLength={INTRO_MAX}
          autoCapitalize="sentences"
          inputStyle={authInput}
        />

        <Text style={styles.sectionTitle}>{t('profile.interests')}</Text>
        <View style={styles.chipsWrap}>
          {INTEREST_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={t(opt.labelKey)}
              selected={interests.includes(opt.key)}
              onPress={() => toggleInterest(opt.key)}
            />
          ))}
        </View>

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <Button
          label={t('profile.start')}
          onPress={onStart}
          disabled={!canStart}
          loading={loading}
          style={styles.ctaGold}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  card: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
    gap: 8,
  },
  pickerWrap: {
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  ctaGold: {
    backgroundColor: CTA_GOLD,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
});
