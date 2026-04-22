/**
 * 매칭 워커: DB RPC `run_matchmaking_tick()` 호출 (서로 다른 국가 코드 짝, teams + match_requests 갱신).
 * Cron 은 동일 URL POST 로 호출하면 됩니다. 배포 후 `013_run_matchmaking_tick.sql` 을 DB 에 적용해야 합니다.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("run_matchmaking_tick");

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, pairs: data ?? 0 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
