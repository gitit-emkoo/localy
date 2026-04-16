import { supabase } from '@/src/lib/supabase/client';

/** match_requests 기록 후 서버 워커 1회 실행(합의안). 실패해도 매칭 요청 자체는 유효(cron 보강). */
export async function invokeMatchmakingWorker(input: { matchRequestId: string; missionId: string }) {
  const { error } = await supabase.functions.invoke('matchmaking-worker', {
    body: input,
  });
  if (error) {
    console.warn('[invokeMatchmakingWorker]', error.message);
  }
}
