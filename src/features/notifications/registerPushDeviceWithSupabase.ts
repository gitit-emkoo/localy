import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase/client';

const DEVICE_KEY = 'localy_push_install_device_id';

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}

/** 권한 요청 → Expo 푸시 토큰 → `register_push_device_token` RPC. Web에서는 noop. */
export async function registerPushDeviceWithSupabase(): Promise<void> {
  if (Platform.OS === 'web') return;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  if (!projectId) {
    console.warn('[push] EAS projectId가 없어 푸시 토큰을 건너뜁니다. app.json extra.eas.projectId를 설정하세요.');
    return;
  }

  let expoPushToken: string;
  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = tokenRes.data;
  } catch (e) {
    console.warn('[push] getExpoPushTokenAsync 실패', e);
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  const { error } = await supabase.rpc('register_push_device_token', {
    p_device_id: deviceId,
    p_platform: platform,
    p_push_token: expoPushToken,
  });
  if (error) {
    console.warn('[push] register_push_device_token', error.message);
  }
}
