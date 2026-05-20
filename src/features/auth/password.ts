import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { requireEnv } from '@/src/lib/env';
import { supabase } from '@/src/lib/supabase/client';

export const PASSWORD_MIN_LENGTH = 6;

export function isValidPasswordLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timeout:${ms}ms`)), ms);
  });
  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const PW_DBG = typeof __DEV__ !== 'undefined' && __DEV__;

/** Metro / Xcode 로그에서 `[changePassword]` 로 필터링 */
function pwLog(step: string, detail?: Record<string, unknown>) {
  if (!PW_DBG) return;
  console.warn(`[changePassword] ${step}`, detail ?? {});
}

/** AsyncStorage를 쓰지 않는 클라이언트 — 검증 로그인 + 비밀번호 변경만 수행 후 메인에 한 번 동기화 */
function createEphemeralVerifyClient(): SupabaseClient {
  const store: Record<string, string> = {};
  const storage = {
    getItem: async (key: string) => store[key] ?? null,
    setItem: async (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: async (key: string) => {
      delete store[key];
    },
  };
  return createClient(requireEnv('EXPO_PUBLIC_SUPABASE_URL'), requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: {
      storage,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * 현재 비밀번호 확인 후 새 비밀번호로 변경.
 *
 * 메인 클라이언트 세션과 충돌을 피하기 위해 검증/변경은 ephemeral 클라이언트에서만 수행한다.
 * 변경 성공 시 화면 레이어에서 signOut 후 재로그인시키는 흐름을 사용한다.
 */
export async function changePasswordWithCurrent(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ error: Error | null }> {
  const verifyClient = createEphemeralVerifyClient();
  const t0 = Date.now();
  try {
    pwLog('1_start', { emailHost: email.includes('@') ? email.split('@')[1] : '—' });

    const signIn = await withTimeout(
      verifyClient.auth.signInWithPassword({ email, password: currentPassword }),
      45_000,
    );
    pwLog('2_signIn_done', { ok: !signIn.error, ms: Date.now() - t0 });
    if (signIn.error) {
      return { error: new Error(signIn.error.message) };
    }

    pwLog('3_updateUser_start');
    const upd = await withTimeout(verifyClient.auth.updateUser({ password: newPassword }), 90_000);
    pwLog('4_updateUser_done', { ok: !upd.error, ms: Date.now() - t0 });
    if (upd.error) {
      void verifyClient.auth.signOut().catch(() => {});
      return { error: new Error(upd.error.message) };
    }

    pwLog('5_success', { ms: Date.now() - t0 });
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    pwLog('catch', { message, ms: Date.now() - t0 });
    if (message.startsWith('timeout:')) {
      // 타임아웃이어도 서버에는 반영됐을 수 있어 최종 상태를 새 비밀번호 로그인으로 재검증한다.
      const verifyFinal = await createEphemeralVerifyClient().auth.signInWithPassword({
        email,
        password: newPassword,
      });
      if (!verifyFinal.error) {
        pwLog('timeout_but_changed_confirmed');
        return { error: null };
      }
    }
    void verifyClient.auth.signOut().catch(() => {});
    return { error: new Error(message) };
  }
}

/** recovery 세션에서 새 비밀번호 저장 */
export async function updatePassword(
  newPassword: string,
  emailForVerify?: string,
): Promise<{ error: Error | null }> {
  const t0 = Date.now();
  try {
    const upd = await withTimeout(supabase.auth.updateUser({ password: newPassword }), 90_000);
    if (PW_DBG) {
      console.warn('[updatePassword] updateUser ok', { ms: Date.now() - t0 });
    }
    return { error: upd.error ? new Error(upd.error.message) : null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    if (PW_DBG) {
      console.warn('[updatePassword] updateUser threw', { ms: Date.now() - t0, message });
    }
    if (message.startsWith('timeout:') && emailForVerify) {
      // 서버 반영은 되었는데 클라이언트 응답만 지연되는 경우를 보정한다.
      const verifyClient = createEphemeralVerifyClient();
      const verifyRes = await withTimeout(
        verifyClient.auth.signInWithPassword({
          email: emailForVerify,
          password: newPassword,
        }),
        60_000,
      );
      void verifyClient.auth.signOut().catch(() => {});
      if (!verifyRes.error) {
        if (PW_DBG) {
          console.warn('[updatePassword] recovered after timeout via signIn only', { totalMs: Date.now() - t0 });
        }
        return { error: null };
      }
    }
    return { error: new Error(message) };
  }
}
