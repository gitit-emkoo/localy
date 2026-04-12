-- Reactions and saved cards for result-card detail
-- Run after 004_submissions_result_cards_storage.sql

create extension if not exists pgcrypto;

-- 1) icon reactions
create table if not exists public.card_icon_reactions (
  id uuid primary key default gen_random_uuid(),
  result_card_id uuid not null references public.result_cards (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  reaction_type text not null check (reaction_type in ('interesting', 'nice', 'surprised', 'relatable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (result_card_id, user_id)
);

create index if not exists idx_icon_reactions_card on public.card_icon_reactions (result_card_id);

drop trigger if exists trg_icon_reactions_updated_at on public.card_icon_reactions;
create trigger trg_icon_reactions_updated_at
before update on public.card_icon_reactions
for each row execute function public.set_updated_at();

-- 2) expression reactions
create table if not exists public.card_expression_reactions (
  id uuid primary key default gen_random_uuid(),
  result_card_id uuid not null references public.result_cards (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  expression_key text not null,
  expression_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (result_card_id, user_id)
);

create index if not exists idx_expression_reactions_card on public.card_expression_reactions (result_card_id);

drop trigger if exists trg_expression_reactions_updated_at on public.card_expression_reactions;
create trigger trg_expression_reactions_updated_at
before update on public.card_expression_reactions
for each row execute function public.set_updated_at();

-- 3) saved cards
create table if not exists public.saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  result_card_id uuid not null references public.result_cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, result_card_id)
);

create index if not exists idx_saved_cards_user on public.saved_cards (user_id);
create index if not exists idx_saved_cards_card on public.saved_cards (result_card_id);

-- Helper: card visibility for current auth user
create or replace function public.can_view_result_card(card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.result_cards rc
    where rc.id = card_id
      and (
        rc.status = 'open'
        or exists (
          select 1
          from public.teams t
          join public.user_profiles me on me.auth_user_id = auth.uid()
          where t.id = rc.team_id
            and (me.id = t.user_a_id or me.id = t.user_b_id)
        )
      )
  );
$$;

revoke all on function public.can_view_result_card(uuid) from public;
grant execute on function public.can_view_result_card(uuid) to authenticated;

-- RLS
alter table public.card_icon_reactions enable row level security;
alter table public.card_expression_reactions enable row level security;
alter table public.saved_cards enable row level security;

drop policy if exists "icon_reactions_select_visible_card" on public.card_icon_reactions;
create policy "icon_reactions_select_visible_card" on public.card_icon_reactions
for select to authenticated
using (public.can_view_result_card(result_card_id));

drop policy if exists "icon_reactions_write_own" on public.card_icon_reactions;
create policy "icon_reactions_write_own" on public.card_icon_reactions
for all to authenticated
using (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(result_card_id)
)
with check (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(result_card_id)
);

drop policy if exists "expression_reactions_select_visible_card" on public.card_expression_reactions;
create policy "expression_reactions_select_visible_card" on public.card_expression_reactions
for select to authenticated
using (public.can_view_result_card(result_card_id));

drop policy if exists "expression_reactions_write_own" on public.card_expression_reactions;
create policy "expression_reactions_write_own" on public.card_expression_reactions
for all to authenticated
using (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(result_card_id)
)
with check (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(result_card_id)
);

drop policy if exists "saved_cards_select_own" on public.saved_cards;
create policy "saved_cards_select_own" on public.saved_cards
for select to authenticated
using (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
);

drop policy if exists "saved_cards_write_own" on public.saved_cards;
create policy "saved_cards_write_own" on public.saved_cards
for all to authenticated
using (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(result_card_id)
)
with check (
  user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(result_card_id)
);

-- Update storage select policy so open cards can be read by logged-in users.
drop policy if exists "mission_photos_select_team" on storage.objects;
create policy "mission_photos_select_team"
on storage.objects for select to authenticated
using (
  bucket_id = 'mission-photos'
  and (
    -- Team members can always read their team's mission photos
    exists (
      select 1
      from public.teams t
      join public.user_profiles me on me.auth_user_id = auth.uid()
      where t.id::text = split_part(name, '/', 1)
        and (me.id = t.user_a_id or me.id = t.user_b_id)
    )
    -- Open result-card photos are readable for all authenticated users
    or exists (
      select 1
      from public.result_cards rc
      where rc.team_id::text = split_part(name, '/', 1)
        and rc.status = 'open'
    )
  )
);
