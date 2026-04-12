-- Localy: missions, teams, match_requests + RLS
-- Run in Supabase SQL Editor after 001_init.sql

create extension if not exists pgcrypto;

-- 1) missions
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  mission_date date not null,
  category_key text not null,
  title text not null,
  short_description text not null,
  notice_text text not null default '',
  is_time_sensitive boolean not null default false,
  status text not null check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists missions_one_published_per_date
  on public.missions (mission_date)
  where status = 'published';

create index if not exists idx_missions_date_status on public.missions (mission_date, status);

drop trigger if exists trg_missions_updated_at on public.missions;
create trigger trg_missions_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

-- 2) teams (created before match_requests.team_id FK)
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  user_a_id uuid not null references public.user_profiles (id) on delete cascade,
  user_b_id uuid not null references public.user_profiles (id) on delete cascade,
  user_a_country_code text not null,
  user_b_country_code text not null,
  match_status text not null default 'matched'
    check (match_status in ('matched', 'ready_to_view', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a_id <> user_b_id),
  check (user_a_country_code <> user_b_country_code)
);

create index if not exists idx_teams_mission on public.teams (mission_id);

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

-- 3) match_requests
create table if not exists public.match_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  status text not null check (status in ('idle', 'matching', 'matched', 'failed', 'cancelled')),
  timezone_offset_minutes integer not null default 0,
  preferred_interest_keys jsonb,
  team_id uuid references public.teams (id) on delete set null,
  requested_at timestamptz not null default now(),
  matched_at timestamptz,
  updated_at timestamptz not null default now(),
  failed_at timestamptz,
  unique (user_id, mission_id)
);

create index if not exists idx_match_requests_user on public.match_requests (user_id);
create index if not exists idx_match_requests_mission on public.match_requests (mission_id);

drop trigger if exists trg_match_requests_updated_at on public.match_requests;
create trigger trg_match_requests_updated_at
before update on public.match_requests
for each row execute function public.set_updated_at();

-- RLS
alter table public.missions enable row level security;
alter table public.teams enable row level security;
alter table public.match_requests enable row level security;

drop policy if exists "missions_select_published" on public.missions;
create policy "missions_select_published" on public.missions
for select to authenticated
using (status = 'published');

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member" on public.teams
for select to authenticated
using (
  exists (
    select 1
    from public.user_profiles me
    where me.auth_user_id = auth.uid()
      and (me.id = teams.user_a_id or me.id = teams.user_b_id)
  )
);

drop policy if exists "match_requests_all_own" on public.match_requests;
create policy "match_requests_all_own" on public.match_requests
for all to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = match_requests.user_id and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = match_requests.user_id and p.auth_user_id = auth.uid()
  )
);

-- Teammate minimal profile read (doc 7-3 A).
-- Use SECURITY DEFINER helper so RLS on user_profiles does not recurse.
create or replace function public.is_teammate_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where (t.user_a_id = target_profile_id or t.user_b_id = target_profile_id)
      and (t.user_a_id = me.id or t.user_b_id = me.id)
      and target_profile_id <> me.id
  );
$$;

revoke all on function public.is_teammate_profile(uuid) from public;
grant execute on function public.is_teammate_profile(uuid) to authenticated;

drop policy if exists "profiles_select_teammate" on public.user_profiles;
create policy "profiles_select_teammate" on public.user_profiles
for select to authenticated
using (public.is_teammate_profile(id));

-- Dev seed: today’s published mission (re-run INSERT manually for other dates)
insert into public.missions (mission_date, category_key, title, short_description, notice_text, is_time_sensitive, status)
select current_date, 'daily_life', 'Sample mission', 'Complete the same mission in different countries today.', '', false, 'published'
where not exists (
  select 1 from public.missions m where m.mission_date = current_date and m.status = 'published'
);
