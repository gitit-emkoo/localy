import { supabase } from '@/src/lib/supabase/client';

export async function requestEmailOtp(email: string) {
  // Supabase Email OTP (code) ÇÃ·Î¿ì: signInWithOtp ¡æ verifyOtp
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
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
