import { supabase } from '@/src/lib/supabase/client';

export async function invokePushDispatcher(limit = 30) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return;

  const { error } = await supabase.functions.invoke('push-dispatcher', {
    body: { limit },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (error) {
    console.warn('[invokePushDispatcher]', error.message);
  }
}

