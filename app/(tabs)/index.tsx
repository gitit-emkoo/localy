import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { FlagPairRow } from '@/components/ui/FlagPairRow';
import { Text } from '@/components/Themed';
import { loadMyProfile } from '@/src/features/profile/loadMyProfile';
import {
  fetchLatestMatchRequest,
  fetchOpenResultCardIdForTeam,
  fetchPartnerProfile,
  fetchActiveMission,
  fetchTeam,
  getMyProfileId,
  matchRequestStatusToMatchState,
  startOrResumeMatchRequest,
  type MatchRequestRow,
  type MissionRow,
  type PartnerProfileRow,
  type TeamRow,
} from '@/src/features/mission/todayMission';
import type { MatchState } from '@/src/types/domain';
import { useAuthStore } from '@/src/stores/useAuthStore';
import { loadBoardCards, type BoardCardItem } from '@/src/features/board/loadBoardCards';
import { useMissionRemainingLabel } from '@/src/hooks/useMissionRemainingLabel';
import { invokeMatchmakingWorker } from '@/src/features/mission/invokeMatchmakingWorker';

const HOME_BOARD_PREVIEW_LIMIT = 6;

const BOARD_GRID_GAP = 2;
const BOARD_COLS = 3;

/** 오늘의 미션 카드: 노란 포인트 + 흰 텍스트(시안용, 전역 다크 전환 전) */
const MISSION_ACCENT = '#D4A017';
const MISSION_ACCENT_SOFT = '#E8AC16';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const authPhase = useAuthStore((s) => s.authPhase);
  const boardPreviewCellWidth =
    (windowWidth - (BOARD_COLS - 1) * BOARD_GRID_GAP) / BOARD_COLS;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [mission, setMission] = useState<MissionRow | null>(null);
  const [matchRequest, setMatchRequest] = useState<MatchRequestRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [partner, setPartner] = useState<PartnerProfileRow | null>(null);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState<string>('');

  const [matchActionLoading, setMatchActionLoading] = useState(false);
  /** 매칭된 팀에 open 결과 카드가 있으면 홈 CTA를 참여 완료 문구로 */
  const [teamOpenResultCardId, setTeamOpenResultCardId] = useState<string | null>(null);

  const [boardPreview, setBoardPreview] = useState<BoardCardItem[]>([]);
  const [boardPreviewError, setBoardPreviewError] = useState<string | null>(null);
  const lastWorkerInvokeAtRef = useRef(0);

  const syncMatchOnly = useCallback(
    async (input: { silent?: boolean } = {}) => {
      if (!myProfileId || !mission?.id) return;

      const mrRes = await fetchLatestMatchRequest(myProfileId, mission.id);
      if (mrRes.error) {
        // 매칭 동기화 폴링에서는 일시적인 네트워크/레이스 에러를 화면 에러로 노출하지 않는다.
        if (!input.silent) setErrorText(t('home.loadError'));
        return;
      }

      const mr = mrRes.data as MatchRequestRow | null;
      setMatchRequest(mr);

      if (mr?.status === 'matched' && mr.team_id) {
        const teamRes = await fetchTeam(mr.team_id);
        const tr = teamRes.data as TeamRow | null;
        setTeam(tr ?? null);
        if (tr) {
          const pr = await fetchPartnerProfile(tr, myProfileId);
          setPartner(pr.data);
          const rcId = await fetchOpenResultCardIdForTeam(mr.team_id);
          setTeamOpenResultCardId(rcId);
        } else {
          setPartner(null);
          setTeamOpenResultCardId(null);
        }
      } else {
        setTeam(null);
        setPartner(null);
        setTeamOpenResultCardId(null);
      }
    },
    [myProfileId, mission?.id, t],
  );

  const load = useCallback(async () => {
    setErrorText(null);
    const boardPromise = loadBoardCards('latest', { limit: HOME_BOARD_PREVIEW_LIMIT });

    try {
      setTeamOpenResultCardId(null);
      const pid = await getMyProfileId();
      setMyProfileId(pid);
      const my = await loadMyProfile();
      setMyNickname(my.data?.profile.nickname ?? '');

      const missionRes = await fetchActiveMission();
      if (missionRes.error) {
        setMission(null);
        setMatchRequest(null);
        setTeam(null);
        setPartner(null);
        setErrorText(t('home.loadError'));
        return;
      }

      const m = missionRes.data as MissionRow | null;
      setMission(m);

      if (!pid || !m?.id) {
        setMatchRequest(null);
        setTeam(null);
        setPartner(null);
        return;
      }

      const mrRes = await fetchLatestMatchRequest(pid, m.id);
      if (mrRes.error) {
        setMatchRequest(null);
        setTeam(null);
        setPartner(null);
        setErrorText(t('home.loadError'));
        return;
      }

      const mr = mrRes.data as MatchRequestRow | null;
      setMatchRequest(mr);

      if (mr?.status === 'matched' && mr.team_id) {
        const teamRes = await fetchTeam(mr.team_id);
        const tr = teamRes.data as TeamRow | null;
        setTeam(tr ?? null);
        if (tr) {
          const pr = await fetchPartnerProfile(tr, pid);
          setPartner(pr.data);
          const rcId = await fetchOpenResultCardIdForTeam(mr.team_id);
          setTeamOpenResultCardId(rcId);
        } else {
          setPartner(null);
        }
      } else {
        setTeam(null);
        setPartner(null);
      }
    } finally {
      const br = await boardPromise;
      if (br.error) {
        setBoardPreview([]);
        setBoardPreviewError(`${t('board.loadError')}\n${br.error.message}`);
      } else {
        setBoardPreview(br.data);
        setBoardPreviewError(null);
      }
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      // 세션 복원 전에 missions를 조회하면 RLS로 행이 0건이 되어 '미션 없음'으로 보일 수 있음
      if (authPhase === 'booting') return;
      setLoading(true);
      void load();
    }, [load, authPhase]),
  );

  useEffect(() => {
    if (matchRequest?.status !== 'matching' || !myProfileId || !mission?.id) return;

    let alive = true;
    const run = async () => {
      if (!alive) return;
      await syncMatchOnly({ silent: true });
      // Scheduler가 없는 환경에서도 대기 중 요청이 오래 남지 않도록 워커를 주기적으로 재호출한다.
      const now = Date.now();
      const shouldInvokeWorker = now - lastWorkerInvokeAtRef.current >= 8000;
      if (shouldInvokeWorker && matchRequest?.id) {
        lastWorkerInvokeAtRef.current = now;
        void invokeMatchmakingWorker({ matchRequestId: matchRequest.id, missionId: mission.id });
      }
    };

    void run();
    const timer = setInterval(() => {
      void run();
    }, 2500);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [matchRequest?.id, matchRequest?.status, myProfileId, mission?.id, syncMatchOnly]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const matchState: MatchState = matchRequestStatusToMatchState(matchRequest?.status);
  const missionRemainingLabel = useMissionRemainingLabel(mission?.valid_to);
  const missionCategoryLabelKey = toInterestLabelKey(mission?.category_key);
  const missionCategoryLabel = missionCategoryLabelKey
    ? t(`profile.interest.${missionCategoryLabelKey}` as any)
    : t('mission.categoryFallback');

  function confirmStartMatch() {
    Alert.alert(t('home.confirmMatchTitle'), t('home.confirmMatchMessage'), [
      { text: t('home.confirmCancel'), style: 'cancel' },
      {
        text: t('home.confirmStart'),
        onPress: () => void runStartMatch(),
      },
    ]);
  }

  async function runStartMatch() {
    if (!myProfileId || !mission?.id) return;
    setMatchActionLoading(true);
    setErrorText(null);
    const tz = new Date().getTimezoneOffset();
    const res = await startOrResumeMatchRequest({
      profileId: myProfileId,
      missionId: mission.id,
      timezoneOffsetMinutes: tz,
    });
    setMatchActionLoading(false);
    if (res.error) {
      const msg = String(res.error.message);
      if (msg === 'already_matched') {
        await load();
        return;
      }
      if (msg === 'match_retry_cooldown') {
        Alert.alert(t('home.matchRetryCooldown'));
        return;
      }
      if (msg === 'match_expired') {
        Alert.alert(t('home.matchExpiredTitle'), t('home.matchExpiredBody'));
        return;
      }
      setErrorText(t('home.loadError'));
      return;
    }
    await load();
  }

  function primaryButton() {
    if (!mission) return null;

    const ctaYellow = { backgroundColor: MISSION_ACCENT };

    if (matchState === 'idle') {
      return (
        <Button
          label={t('home.matchStart')}
          onPress={confirmStartMatch}
          loading={matchActionLoading}
          style={ctaYellow}
        />
      );
    }

    if (matchState === 'matching') {
      return (
        <Button
          label={t('home.matchMatching')}
          onPress={() => {}}
          disabled
          loading={false}
          style={ctaYellow}
        />
      );
    }

    if (matchState === 'matched') {
      const done = Boolean(teamOpenResultCardId);
      return (
        <Button
          label={done ? t('home.joinMissionComplete') : t('home.joinMission')}
          onPress={() => router.push('/team-mission' as any)}
          style={ctaYellow}
        />
      );
    }

    if (matchState === 'match_failed') {
      return (
        <Button
          label={t('home.matchRetry')}
          onPress={confirmStartMatch}
          loading={matchActionLoading}
          style={ctaYellow}
        />
      );
    }

    if (matchState === 'expired') {
      return null;
    }

    return null;
  }

  function statusMessage(): string {
    if (!mission) return '';
    if (matchState === 'idle') return t('home.matchIdleHint');
    if (matchState === 'matching') return t('home.matchMatchingHint');
    if (matchState === 'matched') return t('home.matchMatchedHint');
    if (matchState === 'expired') return t('home.matchExpiredHint');
    return t('home.matchFailedHint');
  }

  const matchedFlagPair =
    team && myProfileId
      ? team.user_a_id === myProfileId
        ? [team.user_a_country_code, team.user_b_country_code]
        : [team.user_b_country_code, team.user_a_country_code]
      : null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.homeTopDark}>
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>
            {t('home.greeting', { nickname: myNickname || t('home.userFallback') })}
          </Text>
          <Text style={styles.heroTagline}>{t('home.heroTagline')}</Text>
        </View>

        {!mission ? (
          <View style={[styles.card, styles.cardOnDark]}>
            <Text style={styles.cardTitleOnDark}>{t('home.noMission')}</Text>
            <Text style={styles.mutedOnDark}>{t('home.noMissionHint')}</Text>
          </View>
        ) : (
          <View style={[styles.card, styles.missionCard]}>
          <View style={styles.missionEyebrowPill}>
            <Text style={styles.missionEyebrowText}>{t('home.todayMission')}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.missionBadge}>
              <Text style={styles.missionBadgeText}>
                {missionCategoryLabel}
              </Text>
            </View>
            {missionRemainingLabel ? (
              <View style={styles.missionBadgeMuted}>
                <Text style={styles.missionBadgeMutedText}>{missionRemainingLabel}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => Alert.alert(t('home.missionNoticeTitle'), t('home.missionNoticeBody'))}>
              <FontAwesome name="info-circle" size={18} color="rgba(255,255,255,0.65)" />
            </Pressable>
          </View>
          <Text style={styles.missionCardTitle}>{mission.title}</Text>
          <View style={styles.missionSubWrap}>
            {mission.short_description?.trim() ? (
              <Text style={styles.missionBody}>{mission.short_description}</Text>
            ) : (
              <>
                <Text style={styles.missionBody}>{t('home.missionSubline1')}</Text>
                <Text style={styles.missionBody}>{t('home.missionSubline2')}</Text>
              </>
            )}
          </View>

          <View style={styles.missionDivider} />

          <Text style={styles.missionStatus}>{statusMessage()}</Text>

          {matchState === 'matched' && matchedFlagPair ? (
            <View style={styles.teamFlagsRow} accessibilityLabel={t('home.teamFlagsA11y')}>
              <FlagPairRow
                codeA={matchedFlagPair[0]}
                codeB={matchedFlagPair[1]}
                pairOrder="as_is"
                flagFontSize={22}
              />
            </View>
          ) : null}

          {primaryButton()}
        </View>
        )}

        {errorText ? <Text style={styles.errorOnDark}>{errorText}</Text> : null}
      </View>

      <View style={styles.cardMuted}>
        <View style={styles.boardBlockInset}>
          <View style={styles.boardPreviewHeader}>
            <Text style={styles.cardTitle}>{t('home.boardPreviewTitle')}</Text>
            <Pressable onPress={() => router.push('/(tabs)/board' as any)} hitSlop={8}>
              <Text style={styles.boardMore}>{t('home.boardMore')}</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>{t('home.boardPreviewHint')}</Text>

          {boardPreviewError ? <Text style={styles.boardPreviewErr}>{boardPreviewError}</Text> : null}

          {!boardPreview.length && !boardPreviewError ? (
            <Text style={styles.muted}>{t('board.emptyBody')}</Text>
          ) : null}
        </View>

        {boardPreview.length > 0 ? (
          <View
            style={[
              styles.boardInstaGrid,
              {
                width: windowWidth,
                marginHorizontal: -20,
                gap: BOARD_GRID_GAP,
              },
            ]}>
            {boardPreview.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.boardInstaCell, { width: boardPreviewCellWidth }]}
                onPress={() => router.push(`/result-card/${item.id}` as any)}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.boardInstaImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.boardInstaImage, styles.previewImageFallback]}>
                    <Text style={styles.previewFallbackText}>LOCALY</Text>
                  </View>
                )}
                <View style={styles.previewCardBody}>
                  <Text numberOfLines={1} style={styles.previewCardTitle}>
                    {item.missionTitle || t('board.cardMissionFallback')}
                  </Text>
                  <View style={styles.previewMetaRow}>
                    <FlagPairRow
                      codeA={item.countryCodeA}
                      codeB={item.countryCodeB}
                      viewerCountryCode={item.viewerCountryCode}
                    />
                    <Text numberOfLines={1} style={styles.previewReactions}>
                      {t('board.reactions', { count: item.totalReactionCount })}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: '#fff',
  },
  homeTopDark: {
    marginHorizontal: -20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    backgroundColor: '#000',
    gap: 16,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
  },
  hero: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 4,
  },
  heroGreeting: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    color: 'rgba(255,255,255,0.95)',
  },
  heroTagline: {
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '700',
  },
  missionSubWrap: {
    gap: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  cardOnDark: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333333',
  },
  cardTitleOnDark: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  mutedOnDark: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.65)',
  },
  missionCard: {
    backgroundColor: '#141414',
    borderColor: '#2E2E2E',
  },
  missionEyebrowPill: {
    alignSelf: 'flex-start',
    backgroundColor: MISSION_ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  missionEyebrowText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  missionBadge: {
    borderRadius: 999,
    backgroundColor: MISSION_ACCENT_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  missionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  missionBadgeMuted: {
    borderRadius: 999,
    backgroundColor: '#2E2E2E',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  missionBadgeMutedText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  missionCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  missionBody: {
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.88)',
  },
  missionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#3A3A3A',
    marginVertical: 6,
  },
  missionStatus: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    color: '#fff',
  },
  cardMuted: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    gap: 0,
  },
  boardBlockInset: {
    paddingHorizontal: 16,
    gap: 8,
  },
  cardEyebrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  badgeMuted: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeMutedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    opacity: 0.85,
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  boardPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  boardMore: {
    fontSize: 14,
    fontWeight: '700',
    color: MISSION_ACCENT,
  },
  boardPreviewErr: {
    fontSize: 12,
    color: '#D92D20',
    marginTop: 4,
  },
  boardInstaGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  boardInstaCell: {
    backgroundColor: '#fff',
  },
  boardInstaImage: {
    width: '100%',
    aspectRatio: 0.95,
  },
  previewImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  previewFallbackText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
  },
  previewCardBody: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 4,
  },
  previewCardTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  previewReactions: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  teamFlagsRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
  errorOnDark: {
    color: '#FCA5A5',
    fontSize: 13,
  },
});

function toInterestLabelKey(categoryKey: string | null | undefined): string | null {
  if (!categoryKey) return null;
  if (categoryKey === 'daily_life') return 'dailyLife';
  if (categoryKey === 'daily_spending') return 'dailySpending';
  if (
    categoryKey === 'food' ||
    categoryKey === 'place' ||
    categoryKey === 'emotion' ||
    categoryKey === 'study' ||
    categoryKey === 'fashion' ||
    categoryKey === 'dailyLife' ||
    categoryKey === 'dailySpending'
  ) {
    return categoryKey;
  }
  return null;
}
