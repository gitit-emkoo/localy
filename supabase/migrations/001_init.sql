-- Localy MVP schema (subset needed for auth/profile gating first)
-- Execute in Supabase SQL Editor.

-- gen_random_uuid() requires pgcrypto in most Postgres setups
create extension if not exists pgcrypto;

-- 1) user_profiles
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  nickname text not null,
  age int not null,
  country_code text not null,
  country_name text not null,
  short_bio text not null,
  intro text,
  profile_image_url text,
  is_profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_auth_user_id on public.user_profiles(auth_user_id);

-- 2) user_interests
create table if not exists public.user_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  interest_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, interest_key)
);

-- 3) user_settings (minimal for language + push)
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  push_match_completed boolean not null default true,
  push_peer_submitted boolean not null default true,
  push_new_reaction boolean not null default true,
  push_new_daily_mission boolean not null default false,
  app_language text not null default 'en',
  translation_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- RLS
alter table public.user_profiles enable row level security;
alter table public.user_interests enable row level security;
alter table public.user_settings enable row level security;

-- Policies: 본인만 접근/수정
-- NOTE: Postgres does not support `create policy if not exists`, so we drop then create.

drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own" on public.user_profiles
for select using (auth.uid() = auth_user_id);

drop policy if exists "profiles_upsert_own" on public.user_profiles;
create policy "profiles_upsert_own" on public.user_profiles
for insert with check (auth.uid() = auth_user_id);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles
for update using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);

drop policy if exists "interests_select_own" on public.user_interests;
create policy "interests_select_own" on public.user_interests
for select using (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
);

drop policy if exists "interests_insert_own" on public.user_interests;
create policy "interests_insert_own" on public.user_interests
for insert with check (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
);

drop policy if exists "interests_delete_own" on public.user_interests;
create policy "interests_delete_own" on public.user_interests
for delete using (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
);

-- user_settings
drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings
for select using (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
);

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own" on public.user_settings
for insert with check (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own" on public.user_settings
for update using (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
) with check (
  exists(select 1 from public.user_profiles p where p.id = user_id and p.auth_user_id = auth.uid())
);
