import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Themed';
import { supabase } from '@/src/lib/supabase/client';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  target_type: 'team' | 'result_card';
  target_id: string;
  is_read: boolean;
  created_at: string;
};

function formatListTime(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await supabase
      .from('notifications')
      .select('id, type, title, body, target_type, target_id, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (res.error) {
      setError(res.error.message);
      setRows([]);
    } else {
      setRows((res.data ?? []) as NotificationRow[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  async function onOpen(row: NotificationRow) {
    const { error: rpcErr } = await supabase.rpc('mark_notification_read', {
      p_notification_id: row.id,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_read: true } : r)));
    }

    if (row.target_type === 'team') {
      router.push(`/team/${row.target_id}` as any);
    } else if (row.target_type === 'result_card') {
      router.push(`/result-card/${row.target_id}` as any);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  if (loading && rows.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: t('nav.notifications') }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('nav.notifications') }} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('notifications.inboxEmpty')}</Text>
        }
        ListHeaderComponent={
          error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void onOpen(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.rowTop}>
              <View style={styles.dotWrap}>{!item.is_read ? <View style={styles.unreadDot} /> : null}</View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.rowTime}>{formatListTime(item.created_at, i18n.language)}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    opacity: 0.7,
  },
  banner: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FECACA',
  },
  bannerText: {
    fontSize: 13,
    color: '#991B1B',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  rowPressed: {
    backgroundColor: '#F9FAFB',
  },
  rowTop: {
    flexDirection: 'row',
    gap: 10,
  },
  dotWrap: {
    width: 10,
    paddingTop: 4,
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  rowMeta: {
    fontSize: 14,
    opacity: 0.78,
    lineHeight: 20,
  },
  rowTime: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: 2,
  },
});
