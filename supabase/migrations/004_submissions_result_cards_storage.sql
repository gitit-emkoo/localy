-- Submissions, result_cards, storage bucket for mission photos
-- Run after 003_fix_teammate_profile_rls.sql

create extension if not exists pgcrypto;

-- 1) submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  photo_url text not null,
  caption_original text not null,
  caption_translated text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'deleted')),
  unique (team_id, user_id)
);

create index if not exists idx_submissions_team on public.submissions (team_id);
create index if not exists idx_submissions_mission on public.submissions (mission_id);

-- 2) result_cards
create table if not exists public.result_cards (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  submission_a_id uuid not null references public.submissions (id) on delete cascade,
  submission_b_id uuid not null references public.submissions (id) on delete cascade,
  status text not null default 'open' check (status in ('locked', 'open')),
  compare_line text,
  total_icon_reaction_count int not null default 0,
  total_expression_reaction_count int not null default 0,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  unique (team_id)
);

create index if not exists idx_result_cards_mission on public.result_cards (mission_id);
create index if not exists idx_result_cards_status on public.result_cards (status);

-- 3) When both teammates submitted, create one open result card (doc 6-8)
create or replace function public.create_result_card_when_pair_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
  s_first uuid;
  s_second uuid;
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  select count(*) into c
  from public.submissions s
  where s.team_id = new.team_id and s.status = 'submitted';

  if c < 2 then
    return new;
  end if;

  if exists (select 1 from public.result_cards rc where rc.team_id = new.team_id) then
    return new;
  end if;

  select s.id into s_first
  from public.submissions s
  where s.team_id = new.team_id and s.status = 'submitted'
  order by s.submitted_at asc, s.id asc
  limit 1;

  select s.id into s_second
  from public.submissions s
  where s.team_id = new.team_id and s.status = 'submitted'
  order by s.submitted_at desc, s.id desc
  limit 1;

  if s_first is null or s_second is null or s_first = s_second then
    return new;
  end if;

  insert into public.result_cards (
    mission_id,
    team_id,
    submission_a_id,
    submission_b_id,
    status,
    opened_at
  )
  values (
    new.mission_id,
    new.team_id,
    s_first,
    s_second,
    'open',
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_submissions_result_card on public.submissions;
create trigger trg_submissions_result_card
after insert on public.submissions
for each row execute function public.create_result_card_when_pair_ready();

revoke all on function public.create_result_card_when_pair_ready() from public;

-- RLS
alter table public.submissions enable row level security;
alter table public.result_cards enable row level security;

drop policy if exists "submissions_select_team" on public.submissions;
create policy "submissions_select_team" on public.submissions
for select to authenticated
using (
  exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where t.id = submissions.team_id
      and (me.id = t.user_a_id or me.id = t.user_b_id)
  )
);

drop policy if exists "submissions_insert_self" on public.submissions;
create policy "submissions_insert_self" on public.submissions
for insert to authenticated
with check (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where t.id = team_id
      and (me.id = t.user_a_id or me.id = t.user_b_id)
      and me.id = user_id
  )
);

drop policy if exists "result_cards_select" on public.result_cards;
create policy "result_cards_select" on public.result_cards
for select to authenticated
using (
  status = 'open'
  or exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where t.id = result_cards.team_id
      and (me.id = t.user_a_id or me.id = t.user_b_id)
  )
);

-- Storage: private bucket for submission images (path: {team_id}/{user_profile_id}/file.jpg)
insert into storage.buckets (id, name, public)
values ('mission-photos', 'mission-photos', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "mission_photos_select_team" on storage.objects;
create policy "mission_photos_select_team"
on storage.objects for select to authenticated
using (
  bucket_id = 'mission-photos'
  and exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where t.id::text = split_part(name, '/', 1)
      and (me.id = t.user_a_id or me.id = t.user_b_id)
  )
);

drop policy if exists "mission_photos_insert_team" on storage.objects;
create policy "mission_photos_insert_team"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mission-photos'
  and exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where t.id::text = split_part(name, '/', 1)
      and (me.id = t.user_a_id or me.id = t.user_b_id)
      and me.id::text = split_part(name, '/', 2)
  )
);
