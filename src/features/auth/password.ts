import { supabase } from '@/src/lib/supabase/client';

export const PASSWORD_MIN_LENGTH = 6;

export function isValidPasswordLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

/** 현재 비밀번호 확인 후 새 비밀번호로 변경 */
export async function changePasswordWithCurrent(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ error: Error | null }> {
  const signIn = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (signIn.error) {
    return { error: new Error(signIn.error.message) };
  }
  const upd = await supabase.auth.updateUser({ password: newPassword });
  return { error: upd.error ? new Error(upd.error.message) : null };
}
