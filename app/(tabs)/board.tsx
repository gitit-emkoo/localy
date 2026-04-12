import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { FlagPairRow } from '@/components/ui/FlagPairRow';
import { loadBoardCards, type BoardCardItem, type BoardSort } from '@/src/features/board/loadBoardCards';
import { useAuthStore } from '@/src/stores/useAuthStore';

const BOARD_GRID_GAP = 2;
const BOARD_COLS = 3;

export default function BoardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const authPhase = useAuthStore((s) => s.authPhase);
  const boardCellWidth =
    (windowWidth - (BOARD_COLS - 1) * BOARD_GRID_GAP) / BOARD_COLS;

  const [sort, setSort] = useState<BoardSort>('latest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [items, setItems] = useState<BoardCardItem[]>([]);

  const load = useCallback(
    async (nextSort: BoardSort) => {
      setErrorText(null);
      const res = await loadBoardCards(nextSort, { limit: 30 });
      if (res.error) {
        setItems([]);
        setErrorText(`${t('board.loadError')}\n${res.error.message}`);
      } else {
        setItems(res.data);
      }
      setLoading(false);
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      if (authPhase === 'booting') return;
      setLoading(true);
      void load(sort);
    }, [load, sort, authPhase]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(sort);
    setRefreshing(false);
  }

  async function onPressSort(nextSort: BoardSort) {
    if (nextSort === sort) return;
    setSort(nextSort);
    setLoading(true);
    await load(nextSort);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.sortRow}>
        <Pressable
          style={[styles.sortChip, sort === 'latest' ? styles.sortChipActive : null]}
          onPress={() => void onPressSort('latest')}>
          <Text style={[styles.sortChipText, sort === 'latest' ? styles.sortChipTextActive : null]}>
            {t('board.sortLatest')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sortChip, sort === 'popular' ? styles.sortChipActive : null]}
          onPress={() => void onPressSort('popular')}>
          <Text style={[styles.sortChipText, sort === 'popular' ? styles.sortChipTextActive : null]}>
            {t('board.sortPopular')}
          </Text>
        </Pressable>
      </View>

      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      {!errorText && !items.length ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{t('board.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('board.emptyBody')}</Text>
        </View>
      ) : null}

      {!errorText && items.length > 0 ? (
        <View
          style={[
            styles.instaGrid,
            { width: windowWidth, marginHorizontal: -20, gap: BOARD_GRID_GAP },
          ]}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.instaCell, { width: boardCellWidth }]}
              onPress={() => router.push(`/result-card/${item.id}` as any)}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.instaImage} resizeMode="cover" />
              ) : (
                <View style={[styles.instaImage, styles.cardImageFallback]}>
                  <Text style={styles.cardImageFallbackText}>LOCALY</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text numberOfLines={1} style={styles.cardTitle}>
                  {item.missionTitle || t('board.cardMissionFallback')}
                </Text>
                <View style={styles.cardMetaRow}>
                  <FlagPairRow
                    codeA={item.countryCodeA}
                    codeB={item.countryCodeB}
                    viewerCountryCode={item.viewerCountryCode}
                  />
                  <Text numberOfLines={1} style={styles.cardReactions}>
                    {t('board.reactions', { count: item.totalReactionCount })}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
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
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 14,
    backgroundColor: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  sortChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2F6BFF',
  },
  sortChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#2F6BFF',
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
  emptyBox: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  instaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  instaCell: {
    backgroundColor: '#fff',
  },
  instaImage: {
    width: '100%',
    aspectRatio: 0.95,
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  cardImageFallbackText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  cardBody: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  cardReactions: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'right',
  },
});
