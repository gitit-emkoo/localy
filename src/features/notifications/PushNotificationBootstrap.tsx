import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

import { hrefFromPushData } from '@/src/features/notifications/hrefFromPushData';
import { registerPushDeviceWithSupabase } from '@/src/features/notifications/registerPushDeviceWithSupabase';
import { useAuthStore } from '@/src/stores/useAuthStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function PushNotificationBootstrap() {
  const router = useRouter();
  const authPhase = useAuthStore((s) => s.authPhase);
  const profilePhase = useAuthStore((s) => s.profilePhase);

  const launchNotificationChecked = useRef(false);

  useEffect(() => {
    if (authPhase === 'signed_out') {
      launchNotificationChecked.current = false;
    }
  }, [authPhase]);

  const navigateFromData = useCallback(
    (data: Record<string, unknown> | undefined) => {
      const href = hrefFromPushData(data ?? null);
      if (href) {
        router.push(href);
      }
    },
    [router],
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (authPhase !== 'signed_in' || profilePhase !== 'profile_completed') return;

    void registerPushDeviceWithSupabase();
  }, [authPhase, profilePhase]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (authPhase !== 'signed_in' || profilePhase !== 'profile_completed') return;
    if (launchNotificationChecked.current) return;
    launchNotificationChecked.current = true;

    void (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      const data = last?.notification?.request?.content?.data as Record<string, unknown> | undefined;
      navigateFromData(data);
    })();
  }, [authPhase, profilePhase, navigateFromData]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (authPhase !== 'signed_in' || profilePhase !== 'profile_completed') return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      navigateFromData(data);
    });

    return () => sub.remove();
  }, [authPhase, profilePhase, navigateFromData]);

  return null;
}
