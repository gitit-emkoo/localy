import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { FlagPairRow } from '@/components/ui/FlagPairRow';
import { loadSavedCards, type MyCardItem } from '@/src/features/my/loadMyCards';

export default function SavedCardsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<MyCardItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await loadSavedCards();
    if (res.error) {
      setItems([]);
      setError(t('my.loadCardsError'));
    } else {
      setItems(res.data);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t('my.savedCardsTitle') }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Stack.Screen options={{ title: t('my.savedCardsTitle') }} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!items.length ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('my.emptySavedCards')}</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/board' as any)}>
            <Text style={styles.buttonText}>{t('my.goBoard')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.resultCard}
              onPress={() => router.push(`/result-card/${item.id}` as any)}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={styles.thumbFallbackText}>LOCALY</Text>
                </View>
              )}
              <View style={styles.meta}>
                <Text numberOfLines={1} style={styles.mission}>
                  {item.missionTitle || t('board.cardMissionFallback')}
                </Text>
                <View style={styles.row}>
                  <FlagPairRow
                    codeA={item.countryCodeA}
                    codeB={item.countryCodeB}
                    viewerCountryCode={item.viewerCountryCode}
                  />
                  <Text numberOfLines={1} style={styles.reactions}>
                    {t('board.reactions', { count: item.reactionCount })}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#D92D20',
    fontSize: 13,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#2F6BFF',
    fontWeight: '700',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  resultCard: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  thumb: {
    width: '100%',
    aspectRatio: 0.95,
  },
  thumbFallback: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  meta: {
    padding: 10,
    gap: 4,
  },
  mission: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  reactions: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'right',
  },
});

