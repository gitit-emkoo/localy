import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { loadMyProfile, type MyProfileRow } from '@/src/features/profile/loadMyProfile';
import { loadMyActivitySummary, type MyActivitySummary } from '@/src/features/my/loadMyDashboard';
import { countryCodeToFlag } from '@/src/lib/countryFlag';

export default function MyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfileRow | null>(null);
  const [summary, setSummary] = useState<MyActivitySummary>({
    joinedMissionCount: 0,
    receivedReactionCount: 0,
    sentExpressionCount: 0,
  });
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorText(null);
    const res = await loadMyProfile();
    if (res.error) {
      setProfile(null);
      setErrorText(t('my.loadError'));
      setLoading(false);
      return;
    }
    if (!res.data) {
      setProfile(null);
      setErrorText(t('my.emptyProfile'));
      setLoading(false);
      return;
    }
    setProfile(res.data.profile);

    const summaryRes = await loadMyActivitySummary(res.data.profile.id);
    if (summaryRes.error || !summaryRes.data) {
      setSummary({ joinedMissionCount: 0, receivedReactionCount: 0, sentExpressionCount: 0 });
      setSummaryError(summaryRes.error?.message ?? null);
    } else {
      setSummary(summaryRes.data);
      setSummaryError(null);
    }
    setLoading(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const countryLabel = useMemo(() => {
    if (!profile?.country_code) return '';
    return t(`country.${profile.country_code}` as any);
  }, [profile?.country_code, t]);

  async function onPressLogout() {
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {!profile ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{errorText ?? t('my.emptyProfile')}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>{t('my.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{t('my.sectionProfile')}</Text>
              <Pressable style={styles.profileEditButton} onPress={() => router.push('/edit-profile' as any)}>
                <FontAwesome name="pencil" size={12} color="#2F6BFF" />
              </Pressable>
            </View>
            <View style={styles.profileRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{profile.nickname.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.profileMain}>
                <View style={styles.profileTopLine}>
                  <Text style={styles.name}>{profile.nickname}</Text>
                  <View style={styles.countryBadge}>
                    <Text style={styles.countryBadgeText}>
                      {countryCodeToFlag(profile.country_code)} {countryLabel || profile.country_name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.line}>
                  {t('my.ageLabel', { age: profile.age })} · {profile.short_bio}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('my.sectionSummary')}</Text>
            {summaryError ? (
              <Text style={styles.summaryErr}>{summaryError}</Text>
            ) : null}
            <View style={styles.summaryRow}>
              <SummaryItem value={summary.joinedMissionCount} label={t('my.summaryJoined')} />
              <SummaryItem value={summary.receivedReactionCount} label={t('my.summaryReceived')} />
              <SummaryItem value={summary.sentExpressionCount} label={t('my.summarySent')} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('my.sectionActivity')}</Text>
            <MenuRow
              icon="folder-open"
              title={t('my.menuMyCards')}
              desc={t('my.menuMyCardsDesc')}
              onPress={() => router.push('/my-results' as any)}
            />
            <MenuRow
              icon="star"
              title={t('my.menuSavedCards')}
              desc={t('my.menuSavedCardsDesc')}
              onPress={() => router.push('/saved-cards' as any)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('my.sectionSettings')}</Text>
            <MenuRow
              icon="bell"
              title={t('my.menuNotif')}
              desc={t('my.menuNotifDesc')}
              onPress={() => router.push('/settings-notifications' as any)}
            />
            <MenuRow
              icon="language"
              title={t('my.menuLanguage')}
              desc={t('my.menuLanguageDesc')}
              onPress={() => router.push('/settings-language' as any)}
            />
            <MenuRow
              icon="user-circle"
              title={t('my.menuAccount')}
              desc={t('my.menuAccountDesc')}
              onPress={() => router.push('/settings-account' as any)}
            />
            <MenuRow
              icon="question-circle"
              title={t('my.menuContact')}
              desc={t('my.menuContactDesc')}
              onPress={() => router.push('/contact' as any)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SummaryItem(props: { value: number; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{props.value}</Text>
      <Text style={styles.summaryLabel}>{props.label}</Text>
    </View>
  );
}

function MenuRow(props: { icon: string; title: string; desc: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menuRow} onPress={props.onPress}>
      <View style={styles.menuIconWrap}>
        <FontAwesome name={props.icon as any} size={14} color="#5F7CFF" />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{props.title}</Text>
        <Text style={styles.menuDesc}>{props.desc}</Text>
      </View>
      <FontAwesome name="angle-right" size={18} color="#9CA3AF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryErr: {
    fontSize: 12,
    color: '#D92D20',
    lineHeight: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileEditButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  profileMain: {
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4E9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5672F4',
  },
  profileTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
  },
  countryBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#EEF2FF',
  },
  countryBadgeText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '700',
  },
  line: {
    fontSize: 13,
    opacity: 0.85,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F4F6FB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
  },
  menuIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
    gap: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    padding: 12,
    gap: 8,
  },
  errorTitle: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FEE2E2',
  },
  retryBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
});
