import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text, View as ThemedView } from '@/components/Themed';
import { TextField } from '@/components/forms/TextField';
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
import { loadMyProfile } from '@/src/features/profile/loadMyProfile';
import type { MvpCountryCode } from '@/src/types/domain';
import { MVP_COUNTRY_CODES } from '@/src/types/domain';

const AGE_OPTIONS = Array.from({ length: 83 }, (_, i) => i + 18);

function toMvpCountryCode(code: string): MvpCountryCode {
  const c = String(code ?? '').toUpperCase();
  return (MVP_COUNTRY_CODES as readonly string[]).includes(c) ? (c as MvpCountryCode) : 'KR';
}

function normalizeInterestKeys(keys: string[]): InterestKey[] {
  const set = new Set(INTEREST_OPTIONS.map((o) => o.key));
  return keys.filter((k): k is InterestKey => set.has(k as InterestKey));
}

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState<number>(32);
  const [countryCode, setCountryCode] = useState<MvpCountryCode>('KR');
  const [shortBio, setShortBio] = useState('');
  const [intro, setIntro] = useState('');
  const [interests, setInterests] = useState<InterestKey[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setErrorText(null);
    setLoadFailed(false);
    const res = await loadMyProfile();
    if (res.error || !res.data) {
      setLoadFailed(true);
      setBooting(false);
      return;
    }
    const { profile, interestKeys } = res.data;
    setNickname(profile.nickname);
    setAge(typeof profile.age === 'number' ? profile.age : 32);
    setCountryCode(toMvpCountryCode(profile.country_code));
    setShortBio(profile.short_bio);
    setIntro(profile.intro ?? '');
    setInterests(normalizeInterestKeys(interestKeys));
    setBooting(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setBooting(true);
      void load();
    }, [load]),
  );

  const countryName = useMemo(() => {
    const found = MVP_COUNTRIES.find((c) => c.code === countryCode);
    return found ? t(found.nameKey) : t('country.KR');
  }, [countryCode, t]);

  const isNicknameValid = nickname.trim().length >= NICKNAME_MIN && nickname.trim().length <= NICKNAME_MAX;
  const isShortBioValid = shortBio.trim().length > 0 && shortBio.trim().length <= SHORT_BIO_MAX;
  const hasInterests = interests.length >= 1;
  const canSave = isNicknameValid && isShortBioValid && hasInterests && Boolean(age) && Boolean(countryCode);

  function toggleInterest(key: InterestKey) {
    setInterests((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  async function onSave() {
    if (!canSave) {
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
    router.back();
  }

  if (booting) {
    return (
      <View style={styles.boot}>
        <Stack.Screen options={{ title: t('my.editProfile') }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.boot}>
        <Stack.Screen options={{ title: t('my.editProfile') }} />
        <Text style={styles.failText}>{t('my.loadError')}</Text>
        <Button
          label={t('my.retry')}
          onPress={() => {
            setBooting(true);
            void load();
          }}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('my.editProfile') }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.header}>
          <Text style={styles.headerSubtitle}>{t('profile.subtitle')}</Text>
        </ThemedView>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.nickname')}</Text>
          <TextField
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('profile.nickname')}
            autoCapitalize="none"
            maxLength={NICKNAME_MAX}
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
                <Picker selectedValue={countryCode} onValueChange={(v: unknown) => setCountryCode(v as MvpCountryCode)}>
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
          />

          <Text style={styles.sectionTitle}>{t('profile.intro')}</Text>
          <TextField
            value={intro}
            onChangeText={setIntro}
            placeholder={t('profile.intro')}
            maxLength={INTRO_MAX}
            autoCapitalize="sentences"
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

          <Button label={t('profile.save')} onPress={() => void onSave()} disabled={!canSave} loading={loading} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  container: {
    paddingBottom: 32,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.8,
  },
  card: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
  failText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
