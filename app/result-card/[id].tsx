import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Text, View } from '@/components/Themed';
import { getExpressionOptions, getVisibleExpressionOptions } from '@/src/constants/resultCardExpressions';
import {
  applyOptimisticExpression,
  applyOptimisticSaved,
  applyOptimisticSubmissionLike,
} from '@/src/features/resultCard/applyOptimisticPatches';
import {
  fetchResultCardDetail,
  setExpressionReaction,
  toggleSavedCard,
  toggleSubmissionLike,
  type ResultCardDetail,
} from '@/src/features/resultCard/resultCard';
import { countryCodeToFlag } from '@/src/lib/countryFlag';

/** ? ?? ?? ??? ?? ??? (`team-mission.tsx`) */
const PANEL_BORDER = '#000';

/**
 * Deep link: localy://result-card/{id}
 */
export default function ResultCardDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<ResultCardDetail | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [likeLoadingId, setLikeLoadingId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [exprListExpanded, setExprListExpanded] = useState(false);
  const [exprSubmitting, setExprSubmitting] = useState(false);
  const [profileModal, setProfileModal] = useState<null | 'a' | 'b'>(null);

  const cardId = String(id ?? '');

  useEffect(() => {
    setExprListExpanded(false);
  }, [cardId]);

  const load = useCallback(async () => {
    if (!cardId) {
      setErrorText('invalid_card_id');
      setDetail(null);
      setLoading(false);
      return;
    }

    const res = await fetchResultCardDetail(cardId);
    if (res.error || !res.data) {
      setDetail(null);
      setErrorText(res.error?.message ?? t('resultCard.loadFailed'));
      setLoading(false);
      return;
    }

    setDetail(res.data);
    setErrorText(null);
    setLoading(false);
  }, [cardId, t]);

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

  const expressionOptions = useMemo(() => {
    if (!detail) return [];
    return getExpressionOptions(detail.missionCategoryKey);
  }, [detail]);

  const expressionCountMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!detail) return m;
    for (const row of detail.expressionSummary) {
      m.set(row.expressionKey, row.count);
    }
    return m;
  }, [detail]);

  const visibleExpressionOptions = useMemo(
    () => getVisibleExpressionOptions(expressionOptions, expressionCountMap, exprListExpanded),
    [expressionOptions, expressionCountMap, exprListExpanded],
  );

  const stackScreenOptions = useMemo(
    () => ({ title: t('nav.resultView'), contentStyle: { backgroundColor: '#fff' as const } }),
    [t],
  );

  async function onTogglePhotoLike(submissionId: string) {
    if (!detail || likeLoadingId) return;
    const snapshot = detail;
    setDetail(applyOptimisticSubmissionLike(detail, submissionId));
    setLikeLoadingId(submissionId);
    const res = await toggleSubmissionLike(submissionId);
    setLikeLoadingId(null);
    if (res.error) {
      setDetail(snapshot);
      Alert.alert(t('resultCard.reactionFailed'), res.error.message);
    }
  }

  async function onToggleSave() {
    if (!detail || saveLoading) return;
    const snapshot = detail;
    const nextSaved = !detail.viewerState.isSaved;
    setDetail(applyOptimisticSaved(detail, nextSaved));
    setSaveLoading(true);
    const res = await toggleSavedCard(detail.id);
    setSaveLoading(false);
    if (res.error) {
      setDetail(snapshot);
      if (String(res.error.message) === 'own_result_card') {
        Alert.alert('', t('resultCard.cannotSaveOwnHint'));
      } else {
        Alert.alert(t('resultCard.saveFailed'), res.error.message);
      }
      return;
    }
    if (typeof res.saved === 'boolean' && res.saved !== nextSaved) {
      setDetail((d) => (d ? applyOptimisticSaved(d, res.saved) : d));
    }
  }

  async function onPickExpression(expressionKey: string) {
    if (!detail || exprSubmitting) return;
    if (detail.viewerState.isOwnResultCard) {
      Alert.alert(t('resultCard.expressionPickBlockedTitle'), t('resultCard.expressionPickBlockedHint'));
      return;
    }
    const chosen = expressionOptions.find((x) => x.key === expressionKey);
    if (!chosen) return;

    const snapshot = detail;
    const expressionText = t(chosen.textKey);
    setDetail(applyOptimisticExpression(detail, chosen.key, expressionText));
    setExprSubmitting(true);
    try {
      const res = await setExpressionReaction({
        resultCardId: detail.id,
        expressionKey: chosen.key,
        expressionText,
      });
      if (res.error) {
        setDetail(snapshot);
        if (String(res.error.message) === 'own_result_card') {
          Alert.alert(t('resultCard.cannotReactOwnTitle'), t('resultCard.cannotReactOwnHint'));
        } else {
          Alert.alert(t('resultCard.expressionFailed'), res.error.message);
        }
      }
    } finally {
      setExprSubmitting(false);
    }
  }

  async function onShare() {
    if (!detail) return;
    const url = `localy://result-card/${detail.id}`;
    await Share.share({
      title: t('resultCard.shareTitle'),
      message: url,
      url,
    });
  }

  function onReport() {
    if (!detail) return;
    Alert.alert(t('resultCard.reportAlertTitle'), t('resultCard.reportAlertMessage'), [
      { text: t('resultCard.cancel'), style: 'cancel' },
      {
        text: t('resultCard.reportOpenMail'),
        onPress: () => {
          const subject = encodeURIComponent(
            t('resultCard.reportMailSubject', { id: detail.id, title: detail.missionTitle }),
          );
          const body = encodeURIComponent(t('resultCard.reportMailBody', { id: detail.id }));
          void Linking.openURL(`mailto:support@localy.app?subject=${subject}&body=${body}`);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={stackScreenOptions} />
        <View style={styles.center} lightColor="#fff" darkColor="#fff">
          <ActivityIndicator />
        </View>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <Stack.Screen options={stackScreenOptions} />
        <View style={styles.center} lightColor="#fff" darkColor="#fff">
          <Text style={styles.title}>{t('nav.resultView')}</Text>
          <Text style={styles.meta}>{errorText ?? t('resultCard.loadFailed')}</Text>
        </View>
      </>
    );
  }

  const canReact = !detail.viewerState.isOwnResultCard;

  return (
    <>
      <Stack.Screen options={stackScreenOptions} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.section, styles.leadSection]}>
          <Text style={styles.missionTitle}>{detail.missionTitle}</Text>
          <View style={styles.compareActionsRow}>
            <Text style={[styles.compare, styles.compareFlex]} numberOfLines={5}>
              {detail.compareLine || t('resultCard.compareFallback')}
            </Text>
            {canReact ? (
              <View style={styles.topIconActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    detail.viewerState.isSaved ? t('resultCard.unsaveAction') : t('resultCard.saveAction')
                  }
                  disabled={saveLoading}
                  hitSlop={10}
                  onPress={() => void onToggleSave()}
                  style={({ pressed }) => [styles.topIconBtn, pressed ? styles.topIconBtnPressed : null]}>
                  <Image
                    source={require('../../assets/mark.png')}
                    style={[styles.topBarIcon, !detail.viewerState.isSaved ? styles.topBarIconDimmed : null]}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('resultCard.reportA11y')}
                  hitSlop={10}
                  onPress={onReport}
                  style={({ pressed }) => [styles.topIconBtn, pressed ? styles.topIconBtnPressed : null]}>
                  <Image
                    source={require('../../assets/siren.png')}
                    style={styles.topBarIcon}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ResultItemCard
            nickname={detail.itemA.nickname}
            countryCode={detail.itemA.countryCode}
            countryName={detail.itemA.countryName}
            age={detail.itemA.age}
            shortBio={detail.itemA.shortBio}
            photoUrl={detail.itemA.photoUrl}
            caption={detail.itemA.captionOriginal}
            likeCount={detail.itemA.likeCount}
            myLike={detail.itemA.myLike}
            likeBusy={likeLoadingId === detail.itemA.submissionId}
            onOpenProfile={() => setProfileModal('a')}
            onToggleLike={() => void onTogglePhotoLike(detail.itemA.submissionId)}
          />
        </View>

        <View style={styles.section}>
          <ResultItemCard
            nickname={detail.itemB.nickname}
            countryCode={detail.itemB.countryCode}
            countryName={detail.itemB.countryName}
            age={detail.itemB.age}
            shortBio={detail.itemB.shortBio}
            photoUrl={detail.itemB.photoUrl}
            caption={detail.itemB.captionOriginal}
            likeCount={detail.itemB.likeCount}
            myLike={detail.itemB.myLike}
            likeBusy={likeLoadingId === detail.itemB.submissionId}
            onOpenProfile={() => setProfileModal('b')}
            onToggleLike={() => void onTogglePhotoLike(detail.itemB.submissionId)}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('resultCard.expressionTitle')}</Text>
            <Pressable
              onPress={() => setExprListExpanded((v) => !v)}
              style={styles.exprPickBtn}
              accessibilityRole="button"
              accessibilityLabel={
                exprListExpanded ? t('resultCard.expressionShowLess') : t('resultCard.expressionShowMore')
              }>
              <Text style={styles.exprPickBtnText}>
                {exprListExpanded ? t('resultCard.expressionShowLess') : t('resultCard.expressionShowMore')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.exprSummaryWrap}>
            {visibleExpressionOptions.map((opt) => {
              const count = expressionCountMap.get(opt.key) ?? 0;
              const mine = detail.viewerState.myExpressionReaction === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  disabled={exprSubmitting}
                  onPress={() => void onPickExpression(opt.key)}
                  style={({ pressed }) => [
                    styles.exprRow,
                    mine ? styles.exprRowMine : null,
                    pressed ? styles.exprRowPressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.emoji} ${t(opt.textKey)}  ${count}`}>
                  <View lightColor="transparent" darkColor="transparent" style={styles.exprRowMain}>
                    <Text style={styles.exprEmoji}>{opt.emoji}</Text>
                    <Text style={styles.exprSummary}>{t(opt.textKey)}</Text>
                  </View>
                  <Text style={styles.exprCount}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, styles.sectionLast]}>
          {detail.viewerState.isOwnResultCard ? (
            <View style={styles.ownCardSaveBlock}>
              <Text style={styles.cannotSaveOwnHint}>{t('resultCard.cannotSaveOwnHint')}</Text>
            </View>
          ) : null}
          <Button label={t('resultCard.shareAction')} variant="secondary" onPress={() => void onShare()} />
        </View>
      </ScrollView>

      <Modal
        visible={profileModal !== null}
        transparent
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => setProfileModal(null)}>
        <View style={styles.profileModalWrap}>
          <Pressable
            style={styles.profileModalBackdropPress}
            onPress={() => setProfileModal(null)}
            accessibilityRole="button"
            accessibilityLabel={t('resultCard.profileModalClose')}
          />
          <View style={styles.profileModalCentered} pointerEvents="box-none">
            <View style={styles.profileModalCard}>
              {profileModal && detail ? (
                <>
                  <ScrollView
                    style={styles.profileModalScroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {(() => {
                      const peer = profileModal === 'a' ? detail.itemA : detail.itemB;
                      const introTrim = peer.intro.trim();
                      return (
                        <>
                          <Text style={styles.profileModalName}>{peer.nickname}</Text>
                          <Text style={styles.profileModalMetaLine}>
                            {countryCodeToFlag(peer.countryCode)} ({peer.countryCode})
                            {' \u00b7 '}
                            {peer.countryName}
                          </Text>
                          <Text style={styles.profileModalRow}>
                            {t('profile.ageLabel', {
                              age: peer.age != null ? String(peer.age) : '\u2014',
                            })}
                          </Text>
                          <Text style={styles.profileModalLabel}>{t('profile.shortBio')}</Text>
                          <Text style={styles.profileModalBody}>{peer.shortBio}</Text>
                          <Text style={styles.profileModalLabel}>{t('resultCard.profileIntroLabel')}</Text>
                          <Text style={styles.profileModalBody}>
                            {introTrim ? peer.intro : t('resultCard.profileIntroEmpty')}
                          </Text>
                        </>
                      );
                    })()}
                  </ScrollView>
                  <Button
                    label={t('resultCard.profileModalClose')}
                    variant="secondary"
                    onPress={() => setProfileModal(null)}
                  />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ResultItemCard(props: {
  nickname: string;
  countryCode: string;
  countryName: string;
  age: number | null;
  shortBio: string;
  photoUrl: string;
  caption: string;
  likeCount: number;
  myLike: boolean;
  likeBusy: boolean;
  onOpenProfile: () => void;
  onToggleLike: () => void;
}) {
  const { t } = useTranslation();
  const flag = countryCodeToFlag(props.countryCode);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={props.onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={t('resultCard.profileModalOpenA11y', { name: props.nickname })}
        style={({ pressed }) => [styles.profileTapZone, pressed ? styles.profileTapPressed : null]}>
        <View style={styles.cardHeadRow}>
          <View style={styles.cardIdentityRow}>
            <Text style={styles.flagText}>{flag}</Text>
            <Text style={styles.countryCodeInline}>({props.countryCode})</Text>
            <Text style={styles.cardTitle}>{props.nickname}</Text>
          </View>
          <View style={styles.countryBadge}>
            <Text style={styles.countryBadgeText}>{props.countryName}</Text>
          </View>
        </View>
        <Text style={styles.profileMetaUnderHeader} numberOfLines={2}>
          {props.age ? `${props.age}` : '-'} / {props.shortBio}
        </Text>
      </Pressable>
      <View style={styles.metaLikeRow}>
        <View style={styles.metaLikeSpacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('resultCard.submissionLikeA11y')}
          disabled={props.likeBusy}
          onPress={props.onToggleLike}
          style={({ pressed }) => [styles.inlineLikeBtn, pressed ? styles.inlineLikePressed : null]}
          hitSlop={8}>
          <FontAwesome
            name={props.myLike ? 'heart' : 'heart-o'}
            size={18}
            color={props.myLike ? '#E11D48' : '#6B7280'}
          />
          <Text style={styles.inlineLikeCount}>{props.likeCount}</Text>
        </Pressable>
      </View>
      {props.photoUrl ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: props.photoUrl }} style={styles.photo} resizeMode="cover" />
        </View>
      ) : null}
      <Text style={styles.caption}>{props.caption}</Text>
    </View>
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
  },
  container: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  leadSection: {
    paddingTop: 4,
    gap: 10,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
    gap: 12,
    backgroundColor: '#fff',
  },
  sectionLast: {
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    fontSize: 12,
    opacity: 0.7,
  },
  missionTitle: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
  },
  compareActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  compareFlex: {
    flex: 1,
    minWidth: 0,
  },
  topIconActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingTop: 1,
  },
  topIconBtn: {
    padding: 6,
    borderRadius: 10,
  },
  topIconBtnPressed: {
    opacity: 0.55,
  },
  topBarIcon: {
    width: 26,
    height: 26,
  },
  topBarIconDimmed: {
    opacity: 0.42,
  },
  compare: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  card: {
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagText: {
    fontSize: 18,
  },
  countryCodeInline: {
    fontSize: 12,
    opacity: 0.7,
  },
  countryBadge: {
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  metaLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardMetaFlex: {
    flex: 1,
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 18,
    minWidth: 0,
  },
  inlineLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  inlineLikePressed: {
    opacity: 0.65,
  },
  inlineLikeCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    minWidth: 18,
  },
  photoWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  ownCardSaveBlock: {
    gap: 8,
  },
  cannotSaveOwnHint: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exprPickBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exprPickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  exprSummaryWrap: {
    gap: 4,
  },
  exprRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  exprRowMine: {
    borderColor: '#2F6BFF',
    backgroundColor: '#EEF2FF',
  },
  exprRowPressed: {
    opacity: 0.88,
  },
  exprRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    paddingRight: 8,
  },
  exprEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  exprSummary: {
    flex: 1,
    fontSize: 13,
    opacity: 0.85,
  },
  exprCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2F6BFF',
  },
  profileTapZone: {
    borderRadius: 12,
  },
  profileTapPressed: {
    opacity: 0.92,
  },
  profileMetaUnderHeader: {
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 18,
    marginTop: 4,
  },
  metaLikeSpacer: {
    flex: 1,
  },
  profileModalWrap: {
    flex: 1,
  },
  profileModalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  profileModalCentered: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  profileModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    width: '88%',
    maxWidth: 320,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  profileModalScroll: {
    maxHeight: 240,
  },
  profileModalName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  profileModalMetaLine: {
    fontSize: 14,
    opacity: 0.85,
    marginBottom: 6,
  },
  profileModalRow: {
    fontSize: 14,
    marginBottom: 12,
  },
  profileModalLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.55,
    marginBottom: 4,
    marginTop: 4,
  },
  profileModalBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
});
