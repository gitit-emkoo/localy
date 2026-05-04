import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type PendingPushJob = {
  job_id: string;
  push_token: string;
  payload_json: Record<string, unknown> | null;
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

async function sendExpoPush(input: {
  pushToken: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  const res = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: input.pushToken,
      title: input.title,
      body: input.body,
      data: input.data,
      sound: "default",
      priority: "high",
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`expo_http_${res.status}: ${text}`);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`expo_invalid_json: ${text}`);
  }
  if (parsed?.data?.status === "error") {
    throw new Error(`expo_push_error: ${parsed?.data?.message ?? "unknown"}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const limit = Number(body?.limit ?? 50);

  const { data: pendingRows, error: fetchErr } = await supabase.rpc("fetch_pending_push_jobs", {
    p_limit: Number.isFinite(limit) ? limit : 50,
  });
  if (fetchErr) {
    return new Response(JSON.stringify({ ok: false, error: fetchErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const jobs = (pendingRows ?? []) as PendingPushJob[];
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const payload = job.payload_json ?? {};
    const title = typeof payload.title === "string"
      ? payload.title
      : (
        payload.type === "RESULT_READY"
          ? "Your result is ready"
          : "Your global teammate is ready"
      );
    const msgBody = typeof payload.body === "string"
      ? payload.body
      : (
        payload.type === "RESULT_READY"
          ? "Both submissions are in. Check your result card."
          : "Your mission team has been matched. Start now."
      );

    try {
      await sendExpoPush({
        pushToken: job.push_token,
        title,
        body: msgBody,
        data: payload,
      });

      const { error: sentErr } = await supabase.rpc("mark_push_job_sent", { p_job_id: job.job_id });
      if (sentErr) {
        failed += 1;
      } else {
        sent += 1;
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown_error";
      await supabase.rpc("mark_push_job_failed", {
        p_job_id: job.job_id,
        p_error: reason,
      });
      failed += 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      total: jobs.length,
      sent,
      failed,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

