import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useAuthBootstrap } from '@/src/hooks/useAuthBootstrap';
import { useAuthStore } from '@/src/stores/useAuthStore';

/**
 * 문서 상태 규칙(5번) 기반 라우팅 가드.
 * - signed_out → (auth)
 * - signed_in + profile_incomplete → (onboarding)
 * - signed_in + profile_completed → (tabs)
 */
export function AuthGate() {
  useAuthBootstrap();

  const router = useRouter();
  const segments = useSegments();

  const authPhase = useAuthStore((s) => s.authPhase);
  const profilePhase = useAuthStore((s) => s.profilePhase);

  useEffect(() => {
    if (authPhase === 'booting') return;

    const group = String(segments[0] ?? ''); // '(tabs)' | '(auth)' | '(onboarding)' | etc

    if (authPhase === 'signed_out') {
      if (group !== '(auth)') {
        router.replace('/(auth)/email' as any);
      }
      return;
    }

    // signed_in
    if (profilePhase === 'profile_incomplete') {
      if (group !== '(onboarding)') {
        router.replace('/(onboarding)/profile' as any);
      }
      return;
    }

    if (profilePhase === 'profile_completed') {
      if (group === '(auth)' || group === '(onboarding)') {
        router.replace('/(tabs)' as any);
      }
    }
  }, [authPhase, profilePhase, router, segments]);

  return null;
}
