import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/forms/TextField';
import { CAPTION_MAX } from '@/src/constants/profile';
import {
  loadTeamMissionContext,
  type SubmissionRow,
  type TeamMissionContext,
} from '@/src/features/mission/loadTeamMissionContext';
import { computeTeamMissionState } from '@/src/features/mission/teamMissionState';
import { submitMissionPhoto } from '@/src/features/mission/submitMission';
import type { TeamMissionState } from '@/src/types/domain';
import { countryCodeToFlag } from '@/src/lib/countryFlag';
import { useMissionRemainingLabel } from '@/src/hooks/useMissionRemainingLabel';

const CTA_GOLD = '#D4A017';
const PANEL_BORDER = '#000';
const FIELD = {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: PANEL_BORDER,
} as const;

export default function TeamMissionScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<TeamMissionContext | null>(null);

  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const next = await loadTeamMissionContext();
    setCtx(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const teamState: TeamMissionState | null = useMemo(() => {
    if (!ctx?.ok) return null;
    const ids = ctx.submissions.map((s: SubmissionRow) => s.user_id);
    return computeTeamMissionState({ myProfileId: ctx.myProfileId, submissionUserIds: ids });
  }, [ctx]);

  const mySubmitted = useMemo(() => {
    if (!ctx?.ok) return false;
    return ctx.submissions.some((s) => s.user_id === ctx.myProfileId);
  }, [ctx]);

  const missionRemainingLabel = useMissionRemainingLabel(
    ctx !== null && ctx.ok === true ? ctx.mission.valid_to : undefined,
  );

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('teamMission.photoPermissionTitle'), t('teamMission.photoPermissionBody'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPicked({ uri: a.uri, width: a.width ?? 1, height: a.height ?? 1 });
  }

  async function onSubmit() {
    if (!ctx?.ok || !teamState) return;
    if (!picked) {
      Alert.alert(t('teamMission.needPhoto'));
      return;
    }
    const cap = caption.trim();
    if (!cap) {
      Alert.alert(t('teamMission.needCaption'));
      return;
    }

    setSubmitting(true);
    const res = await submitMissionPhoto({
      teamId: ctx.team.id,
      missionId: ctx.mission.id,
      profileId: ctx.myProfileId,
      localImageUri: picked.uri,
      imageWidth: picked.width,
      imageHeight: picked.height,
      caption: cap,
    });
    setSubmitting(false);

    if (res.error) {
      Alert.alert(t('teamMission.submitFailed'), res.error.message);
      return;
    }

    setPicked(null);
    setCaption('');
    Alert.alert(t('teamMission.submitSuccess'));
    await load();
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function onViewResult() {
    if (!ctx?.ok) return;
    const id = ctx.resultCard?.id;
    if (!id) {
      Alert.alert(t('teamMission.resultNotReady'));
      return;
    }
    router.push(`/result-card/${id}` as any);
  }

  if (loading || !ctx) {
    return (
      <>
        <Stack.Screen options={{ title: t('teamMission.title') }} />
        <View style={styles.center}>
          <Text>{t('teamMission.loading')}</Text>
        </View>
      </>
    );
  }

  if (!ctx.ok) {
    return (
      <>
        <Stack.Screen options={{ title: t('teamMission.title') }} />
        <View style={styles.center}>
          <Text style={styles.centerText}>
            {ctx.reason === 'no_mission'
              ? t('teamMission.errNoMission')
              : ctx.reason === 'no_profile'
                ? t('teamMission.errNoProfile')
                : t('teamMission.errNoTeam')}
          </Text>
          <Button label={t('teamMission.goBack')} onPress={() => router.back()} style={styles.ctaGold} />
        </View>
      </>
    );
  }

  const progressCount = ctx.submissions.length;

  const canFillForm = !mySubmitted;
  const showSubmit =
    canFillForm &&
    Boolean(picked) &&
    caption.trim().length > 0 &&
    caption.trim().length <= CAPTION_MAX;
  const resultReady = teamState === 'ready_to_view' && Boolean(ctx.resultCard?.id);
  const progressRatio = Math.max(0, Math.min(1, progressCount / 2));
  const myDone = ctx.submissions.some((s) => s.user_id === ctx.me.id);
  const peerDone = ctx.submissions.some((s) => s.user_id === ctx.partner.id);
  const missionCategoryLabelKey = toInterestLabelKey(ctx.mission.category_key);
  const missionCategoryLabel = missionCategoryLabelKey
    ? t(`profile.interest.${missionCategoryLabelKey}` as any)
    : t('mission.categoryFallback');

  return (
    <>
      <Stack.Screen options={{ title: t('teamMission.title') }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.section, styles.missionLeadSection]}>
          <View style={styles.missionBadgeRow}>
            <View style={styles.missionBadge}>
              <Text style={styles.missionBadgeText}>{missionCategoryLabel}</Text>
            </View>
            <Pressable onPress={() => Alert.alert(t('teamMission.noticeTitle'), t('teamMission.noticeBody'))}>
              <FontAwesome name="info-circle" size={18} color="#6B7280" />
            </Pressable>
          </View>
          <Text style={styles.missionTitle}>{ctx.missionTitle}</Text>
          {missionRemainingLabel ? <Text style={styles.missionRemaining}>{missionRemainingLabel}</Text> : null}
          <View style={styles.guideLines}>
            <Text style={styles.muted}>{t('teamMission.missionGuideLine1')}</Text>
            <Text style={styles.muted}>{t('teamMission.missionGuideLine2')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('teamMission.teamSectionTitle')}</Text>
          <View style={styles.memberGrid}>
            <MemberMiniCard
              countryCode={ctx.me.country_code}
              nickname={ctx.me.nickname}
              subline={`${ctx.me.age ? `${ctx.me.age}세` : '-'} · ${ctx.me.short_bio}`}
            />
            <MemberMiniCard
              countryCode={ctx.partner.country_code}
              nickname={ctx.partner.nickname}
              subline={`${ctx.partner.age ? `${ctx.partner.age}세` : '-'} · ${ctx.partner.short_bio}`}
            />
          </View>
        </View>

        {canFillForm ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teamMission.uploadSection')}</Text>
            <View style={styles.borderedPanel}>
              <Text style={styles.panelHint}>{t('teamMission.uploadSectionHint')}</Text>
              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [
                  styles.uploadZone,
                  picked ? styles.uploadZoneHasImage : null,
                  pressed ? styles.uploadZonePressed : null,
                ]}>
                {picked ? (
                  <>
                    <Image source={{ uri: picked.uri }} style={styles.uploadPreviewFill} resizeMode="cover" />
                    <View style={styles.uploadChangeBar} pointerEvents="none">
                      <Text style={styles.uploadChangeBarText}>{t('teamMission.tapToChangePhoto')}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <FontAwesome name="camera" size={32} color="#374151" />
                    <Text style={styles.uploadZoneTitle}>{t('teamMission.uploadAreaTitle')}</Text>
                  </>
                )}
              </Pressable>
              <TextField
                value={caption}
                onChangeText={setCaption}
                placeholder={t('teamMission.captionPlaceholder')}
                maxLength={CAPTION_MAX}
                helperText={`${caption.length}/${CAPTION_MAX}`}
                autoCapitalize="sentences"
                inputStyle={FIELD}
              />
              <Button
                label={t('teamMission.submit')}
                onPress={onSubmit}
                disabled={!showSubmit}
                loading={submitting}
                style={styles.ctaGold}
              />
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teamMission.uploadSection')}</Text>
            <View style={styles.borderedPanel}>
              <Text style={styles.cardTitle}>{t('teamMission.mySubmittedTitle')}</Text>
              <Text style={styles.muted}>{t('teamMission.mySubmittedBody')}</Text>
            </View>
          </View>
        )}

        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.sectionTitle}>{t('teamMission.progressSectionTitle')}</Text>
          <View style={styles.progressTopRow}>
            <Text style={styles.muted}>{t('teamMission.progressLabel')}</Text>
            <Text style={styles.progressCountText}>{t('teamMission.progress', { done: progressCount, total: 2 })}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
          <MemberStatusRow
            title={ctx.me.nickname}
            body={myDone ? t('teamMission.statusDoneBody') : t('teamMission.statusWaitingBody')}
            badgeText={myDone ? t('teamMission.badgeDone') : t('teamMission.badgePending')}
            done={myDone}
          />
          <MemberStatusRow
            title={ctx.partner.nickname}
            body={peerDone ? t('teamMission.statusDoneBodyPeer') : t('teamMission.statusWaitingBodyPeer')}
            badgeText={peerDone ? t('teamMission.badgeDone') : t('teamMission.badgePending')}
            done={peerDone}
          />
          <Button
            label={t('teamMission.viewResult')}
            onPress={onViewResult}
            disabled={!resultReady}
            style={styles.ctaGold}
          />
          {!resultReady && teamState === 'self_submitted_waiting' ? (
            <Text style={styles.muted}>{t('teamMission.waitPeerForResult')}</Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#fff',
  },
  centerText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  ctaGold: {
    backgroundColor: CTA_GOLD,
  },
  container: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  missionLeadSection: {
    paddingTop: 4,
    gap: 10,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  sectionLast: {
    borderBottomWidth: 0,
  },
  missionTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 36,
  },
  missionRemaining: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  missionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionBadge: {
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  missionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  memberGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  borderedPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  panelHint: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
    fontWeight: '600',
  },
  uploadZone: {
    position: 'relative',
    minHeight: 168,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  uploadZoneHasImage: {
    padding: 0,
    justifyContent: 'flex-end',
  },
  uploadZonePressed: {
    opacity: 0.92,
  },
  uploadPreviewFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  uploadChangeBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  uploadChangeBarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  uploadZoneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressCountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: CTA_GOLD,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  muted: {
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 18,
  },
  guideLines: {
    gap: 2,
  },
});

function MemberMiniCard(props: { countryCode: string; nickname: string; subline: string }) {
  const flag = countryCodeToFlag(props.countryCode);
  return (
    <View style={miniStyles.wrap}>
      <View style={miniStyles.top}>
        <Text style={miniStyles.flag}>{flag}</Text>
        <Text style={miniStyles.name}>{props.nickname}</Text>
      </View>
      <Text style={miniStyles.sub}>{props.subline}</Text>
    </View>
  );
}

function MemberStatusRow(props: { title: string; body: string; badgeText: string; done: boolean }) {
  return (
    <View style={statusStyles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={statusStyles.title}>{props.title}</Text>
        <Text style={statusStyles.body}>{props.body}</Text>
      </View>
      <View style={[statusStyles.badge, props.done ? statusStyles.badgeDone : statusStyles.badgePending]}>
        <Text style={[statusStyles.badgeText, props.done ? statusStyles.badgeTextDone : statusStyles.badgeTextPending]}>
          {props.badgeText}
        </Text>
      </View>
    </View>
  );
}

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

const miniStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    padding: 10,
    gap: 5,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flag: {
    fontSize: 18,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
  },
  sub: {
    fontSize: 12,
    opacity: 0.8,
  },
});

const statusStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  body: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeDone: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeTextDone: {
    color: '#166534',
  },
  badgeTextPending: {
    color: '#92400E',
  },
});
