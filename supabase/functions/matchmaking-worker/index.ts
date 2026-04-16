/**
 * 매칭 워커 (MVP 스텁)
 * 실제 매칭·cron 연동은 후속 작업에서 구현합니다.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(() =>
  new Response(JSON.stringify({ ok: true, stub: true }), {
    headers: { 'Content-Type': 'application/json' },
  }),
);
