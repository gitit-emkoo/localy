-- Merge notification id + title/body into push job payload for Expo `data` and dispatcher fallbacks.

create or replace function public.fetch_pending_push_jobs(p_limit int default 50)
returns table (
  job_id uuid,
  user_id uuid,
  notification_id uuid,
  device_token_id uuid,
  push_token text,
  event_type text,
  dedupe_key text,
  payload_json jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    pj.id as job_id,
    pj.user_id,
    pj.notification_id,
    pj.device_token_id,
    dt.push_token,
    pj.event_type,
    pj.dedupe_key,
    (n.payload_json || jsonb_build_object(
      'notificationId', n.id,
      'title', n.title,
      'body', n.body
    )) as payload_json
  from public.push_jobs pj
  join public.push_device_tokens dt on dt.id = pj.device_token_id
  join public.notifications n on n.id = pj.notification_id
  where pj.status = 'pending'
    and pj.retry_count < 5
    and dt.is_active = true
  order by pj.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
