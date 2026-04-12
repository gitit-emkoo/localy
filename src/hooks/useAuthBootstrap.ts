import { useEffect } from 'react';

import { supabase } from '@/src/lib/supabase/client';
import { useAuthStore } from '@/src/stores/useAuthStore';

/**
 * 앱 시작 시 세션/프로필 완료 상태를 서버 기준으로 동기화한다.
 * - signed_out이면 (auth)만 접근
 * - signed_in + profile_incomplete이면 (onboarding) 강제
 */
export function useAuthBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const setAuthPhase = useAuthStore((s) => s.setAuthPhase);
  const setProfilePhase = useAuthStore((s) => s.setProfilePhase);

  useEffect(() => {
    let isMounted = true;

    async function syncFromServer() {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) {
        // 세션 조회 실패는 signed_out으로 처리하고, 화면에서 재로그인 유도.
        setSession(null);
        setAuthPhase('signed_out');
        setProfilePhase('unknown');
        return;
      }

      const session = data.session;
      setSession(session);

      if (!session) {
        setAuthPhase('signed_out');
        setProfilePhase('unknown');
        return;
      }

      setAuthPhase('signed_in');

      // 프로필 완료 여부 확인
      const authUserId = session.user.id;
      const profileRes = await supabase
        .from('user_profiles')
        .select('is_profile_completed')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (!isMounted) return;

      if (profileRes.error) {
        // 테이블/RLS 미설정 등: unknown으로 두고 onboarding으로 유도
        setProfilePhase('profile_incomplete');
        return;
      }

      const isCompleted = Boolean(profileRes.data?.is_profile_completed);
      setProfilePhase(isCompleted ? 'profile_completed' : 'profile_incomplete');
    }

    syncFromServer();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (!session) {
        setAuthPhase('signed_out');
        setProfilePhase('unknown');
        return;
      }

      setAuthPhase('signed_in');
      // 로그인 직후는 프로필을 다시 확인
      const authUserId = session.user.id;
      const profileRes = await supabase
        .from('user_profiles')
        .select('is_profile_completed')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (profileRes.error) {
        setProfilePhase('profile_incomplete');
        return;
      }

      const isCompleted = Boolean(profileRes.data?.is_profile_completed);
      setProfilePhase(isCompleted ? 'profile_completed' : 'profile_incomplete');
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setAuthPhase, setProfilePhase, setSession]);
}
