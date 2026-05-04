-- Notifications + Push (MVP)
-- - notification types: MATCH_COMPLETED, RESULT_READY
-- - in-app notifications are always created
-- - push jobs are created only when user setting allows
-- - dedupe: notifications(user_id, dedupe_key), push_jobs(user_id, dedupe_key, device_token_id)

alter table public.user_settings
  add column if not exists push_result_ready boolean not null default true;

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios', 'android')),
  push_token text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id),
  unique (platform, push_token)
);

create index if not exists idx_push_device_tokens_user_active
  on public.push_device_tokens (user_id, is_active);

drop trigger if exists trg_push_device_tokens_updated_at on public.push_device_tokens;
create trigger trg_push_device_tokens_updated_at
before update on public.push_device_tokens
for each row execute function public.set_updated_at();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  type text not null check (type in ('MATCH_COMPLETED', 'RESULT_READY')),
  title text not null,
  body text not null,
  target_type text not null check (target_type in ('team', 'result_card')),
  target_id uuid not null,
  payload_json jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read, created_at desc);

create table if not exists public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  device_token_id uuid not null references public.push_device_tokens (id) on delete cascade,
  event_type text not null check (event_type in ('MATCH_COMPLETED', 'RESULT_READY')),
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  retry_count int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key, device_token_id)
);

create index if not exists idx_push_jobs_status_created
  on public.push_jobs (status, created_at);

drop trigger if exists trg_push_jobs_updated_at on public.push_jobs;
create trigger trg_push_jobs_updated_at
before update on public.push_jobs
for each row execute function public.set_updated_at();

alter table public.push_device_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.push_jobs enable row level security;

drop policy if exists "push_device_tokens_select_own" on public.push_device_tokens;
create policy "push_device_tokens_select_own" on public.push_device_tokens
for select to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = push_device_tokens.user_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "push_device_tokens_insert_own" on public.push_device_tokens;
create policy "push_device_tokens_insert_own" on public.push_device_tokens
for insert to authenticated
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = push_device_tokens.user_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "push_device_tokens_update_own" on public.push_device_tokens;
create policy "push_device_tokens_update_own" on public.push_device_tokens
for update to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = push_device_tokens.user_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = push_device_tokens.user_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = notifications.user_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = notifications.user_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = notifications.user_id
      and p.auth_user_id = auth.uid()
  )
);

create or replace function public.register_push_device_token(
  p_device_id text,
  p_platform text,
  p_push_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  select p.id into v_user_id
  from public.user_profiles p
  where p.auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  insert into public.push_device_tokens (
    user_id,
    device_id,
    platform,
    push_token,
    is_active,
    last_seen_at
  )
  values (
    v_user_id,
    p_device_id,
    p_platform,
    p_push_token,
    true,
    now()
  )
  on conflict (user_id, device_id)
  do update
  set
    platform = excluded.platform,
    push_token = excluded.push_token,
    is_active = true,
    last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_push_device_token(text, text, text) from public;
grant execute on function public.register_push_device_token(text, text, text) to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select p.id into v_user_id
  from public.user_profiles p
  where p.auth_user_id = auth.uid();

  if v_user_id is null then
    return false;
  end if;

  update public.notifications n
  set
    is_read = true,
    read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.user_id = v_user_id;

  return found;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.enqueue_notification_and_push_jobs(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_target_type text,
  p_target_id uuid,
  p_payload jsonb,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    target_type,
    target_id,
    payload_json,
    dedupe_key
  )
  values (
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_target_type,
    p_target_id,
    coalesce(p_payload, '{}'::jsonb),
    p_dedupe_key
  )
  on conflict (user_id, dedupe_key)
  do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    select n.id
    into v_notification_id
    from public.notifications n
    where n.user_id = p_user_id
      and n.dedupe_key = p_dedupe_key;
  end if;

  insert into public.push_jobs (
    user_id,
    notification_id,
    device_token_id,
    event_type,
    dedupe_key,
    status
  )
  select
    p_user_id,
    v_notification_id,
    dt.id,
    p_type,
    p_dedupe_key,
    'pending'
  from public.push_device_tokens dt
  left join public.user_settings us on us.user_id = p_user_id
  where dt.user_id = p_user_id
    and dt.is_active = true
    and (
      (p_type = 'MATCH_COMPLETED' and coalesce(us.push_match_completed, true))
      or (p_type = 'RESULT_READY' and coalesce(us.push_result_ready, coalesce(us.push_peer_submitted, true)))
    )
  on conflict (user_id, dedupe_key, device_token_id)
  do nothing;

  return v_notification_id;
end;
$$;

revoke all on function public.enqueue_notification_and_push_jobs(uuid, text, text, text, text, uuid, jsonb, text) from public;
grant execute on function public.enqueue_notification_and_push_jobs(uuid, text, text, text, text, uuid, jsonb, text) to service_role;

create or replace function public.enqueue_match_completed_notifications(
  p_team_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.teams;
  c integer := 0;
begin
  select *
  into t
  from public.teams
  where id = p_team_id;

  if not found then
    return 0;
  end if;

  perform public.enqueue_notification_and_push_jobs(
    t.user_a_id,
    'MATCH_COMPLETED',
    'Your global teammate is ready',
    'Your mission team has been matched. Start now.',
    'team',
    t.id,
    jsonb_build_object(
      'type', 'MATCH_COMPLETED',
      'targetType', 'team',
      'targetId', t.id,
      'teamId', t.id
    ),
    'MATCH_COMPLETED:' || t.user_a_id::text || ':' || t.id::text
  );
  c := c + 1;

  perform public.enqueue_notification_and_push_jobs(
    t.user_b_id,
    'MATCH_COMPLETED',
    'Your global teammate is ready',
    'Your mission team has been matched. Start now.',
    'team',
    t.id,
    jsonb_build_object(
      'type', 'MATCH_COMPLETED',
      'targetType', 'team',
      'targetId', t.id,
      'teamId', t.id
    ),
    'MATCH_COMPLETED:' || t.user_b_id::text || ':' || t.id::text
  );
  c := c + 1;

  return c;
end;
$$;

revoke all on function public.enqueue_match_completed_notifications(uuid) from public;
grant execute on function public.enqueue_match_completed_notifications(uuid) to service_role;

create or replace function public.enqueue_result_ready_notifications(
  p_result_card_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rc public.result_cards;
  t public.teams;
  c integer := 0;
begin
  select *
  into rc
  from public.result_cards
  where id = p_result_card_id
    and status = 'open';

  if not found then
    return 0;
  end if;

  select *
  into t
  from public.teams
  where id = rc.team_id;

  if not found then
    return 0;
  end if;

  perform public.enqueue_notification_and_push_jobs(
    t.user_a_id,
    'RESULT_READY',
    'Your result is ready',
    'Both submissions are in. Check your result card.',
    'result_card',
    rc.id,
    jsonb_build_object(
      'type', 'RESULT_READY',
      'targetType', 'result_card',
      'targetId', rc.id,
      'resultCardId', rc.id
    ),
    'RESULT_READY:' || t.user_a_id::text || ':' || rc.id::text
  );
  c := c + 1;

  perform public.enqueue_notification_and_push_jobs(
    t.user_b_id,
    'RESULT_READY',
    'Your result is ready',
    'Both submissions are in. Check your result card.',
    'result_card',
    rc.id,
    jsonb_build_object(
      'type', 'RESULT_READY',
      'targetType', 'result_card',
      'targetId', rc.id,
      'resultCardId', rc.id
    ),
    'RESULT_READY:' || t.user_b_id::text || ':' || rc.id::text
  );
  c := c + 1;

  return c;
end;
$$;

revoke all on function public.enqueue_result_ready_notifications(uuid) from public;
grant execute on function public.enqueue_result_ready_notifications(uuid) to service_role;

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
    n.payload_json
  from public.push_jobs pj
  join public.push_device_tokens dt on dt.id = pj.device_token_id
  join public.notifications n on n.id = pj.notification_id
  where pj.status = 'pending'
    and pj.retry_count < 5
    and dt.is_active = true
  order by pj.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.fetch_pending_push_jobs(int) from public;
grant execute on function public.fetch_pending_push_jobs(int) to service_role;

create or replace function public.mark_push_job_sent(
  p_job_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_jobs
  set
    status = 'sent',
    sent_at = now(),
    last_error = null
  where id = p_job_id;
$$;

revoke all on function public.mark_push_job_sent(uuid) from public;
grant execute on function public.mark_push_job_sent(uuid) to service_role;

create or replace function public.mark_push_job_failed(
  p_job_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_jobs
  set
    status = 'failed',
    retry_count = retry_count + 1,
    last_error = left(coalesce(p_error, 'unknown_error'), 2000)
  where id = p_job_id;
$$;

revoke all on function public.mark_push_job_failed(uuid, text) from public;
grant execute on function public.mark_push_job_failed(uuid, text) to service_role;

create or replace function public.reset_failed_push_jobs_for_retry(
  p_limit int default 50
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with target as (
    select id
    from public.push_jobs
    where status = 'failed'
      and retry_count < 5
    order by updated_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  )
  update public.push_jobs pj
  set status = 'pending'
  where pj.id in (select id from target);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reset_failed_push_jobs_for_retry(int) from public;
grant execute on function public.reset_failed_push_jobs_for_retry(int) to service_role;

