import { supabase } from '@/src/lib/supabase/client';

export async function requestEmailOtp(email: string) {
  // Supabase Email OTP (code) �÷ο�: signInWithOtp �� verifyOtp
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
}

/** ???? ??: ?? ???? ?? ?? */
export async function requestPasswordResetOtp(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });
}

export async function verifyEmailOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
}
