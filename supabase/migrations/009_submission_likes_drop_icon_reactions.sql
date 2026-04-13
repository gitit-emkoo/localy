-- Submission-level hearts (likes); remove card_icon_reactions; total_like_count on result_cards

-- 1) Drop icon reactions (test-era data acceptable to drop)
drop policy if exists "icon_reactions_select_visible_card" on public.card_icon_reactions;
drop policy if exists "icon_reactions_write_own" on public.card_icon_reactions;
drop trigger if exists trg_icon_reactions_updated_at on public.card_icon_reactions;
drop table if exists public.card_icon_reactions;

-- 2) Replace total_icon_reaction_count with total_like_count
alter table public.result_cards drop column if exists total_icon_reaction_count;
alter table public.result_cards add column if not exists total_like_count int not null default 0;

-- 3) submission_likes: one row = one like (toggle = insert/delete)
create table if not exists public.submission_likes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (submission_id, user_id)
);

create index if not exists idx_submission_likes_submission on public.submission_likes (submission_id);

-- 4) Recompute like total for a result card (both submissions)
create or replace function public.refresh_result_card_total_like_count(p_result_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_total int;
begin
  select submission_a_id, submission_b_id into v_a, v_b
  from public.result_cards where id = p_result_card_id;
  if v_a is null then
    return;
  end if;
  select count(*)::int into v_total
  from public.submission_likes
  where submission_id in (v_a, v_b);
  update public.result_cards set total_like_count = v_total where id = p_result_card_id;
end;
$$;

create or replace function public.trg_submission_likes_refresh_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  rc_id uuid;
begin
  sid := coalesce(NEW.submission_id, OLD.submission_id);
  select rc.id into rc_id
  from public.result_cards rc
  where rc.submission_a_id = sid or rc.submission_b_id = sid
  limit 1;
  if rc_id is not null then
    perform public.refresh_result_card_total_like_count(rc_id);
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_submission_likes_refresh on public.submission_likes;
create trigger trg_submission_likes_refresh
after insert or delete on public.submission_likes
for each row execute function public.trg_submission_likes_refresh_card();

-- Backfill totals (no rows yet → zeros; safe after deploy)
update public.result_cards rc
set total_like_count = coalesce(
  (
    select count(*)::int
    from public.submission_likes sl
    where sl.submission_id in (rc.submission_a_id, rc.submission_b_id)
  ),
  0
);

-- 5) RLS: submission_likes
alter table public.submission_likes enable row level security;

drop policy if exists "submission_likes_select_visible" on public.submission_likes;
create policy "submission_likes_select_visible" on public.submission_likes
for select to authenticated
using (
  exists (
    select 1
    from public.result_cards rc
    where (rc.submission_a_id = submission_likes.submission_id or rc.submission_b_id = submission_likes.submission_id)
      and public.can_view_result_card(rc.id)
  )
);

drop policy if exists "submission_likes_insert_valid" on public.submission_likes;
create policy "submission_likes_insert_valid" on public.submission_likes
for insert to authenticated
with check (
  submission_likes.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and exists (
    select 1 from public.submissions s
    where s.id = submission_likes.submission_id and s.user_id <> submission_likes.user_id
  )
  and exists (
    select 1 from public.result_cards rc
    where (rc.submission_a_id = submission_likes.submission_id or rc.submission_b_id = submission_likes.submission_id)
      and public.can_view_result_card(rc.id)
  )
);

drop policy if exists "submission_likes_delete_own" on public.submission_likes;
create policy "submission_likes_delete_own" on public.submission_likes
for delete to authenticated
using (
  submission_likes.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
);

-- 6) Expression reactions: participants cannot add/change (viewer team members only for "other" cards)
drop policy if exists "expression_reactions_write_own" on public.card_expression_reactions;

create policy "expression_reactions_insert_non_participant" on public.card_expression_reactions
for insert to authenticated
with check (
  card_expression_reactions.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(card_expression_reactions.result_card_id)
  and not exists (
    select 1
    from public.result_cards rc
    join public.submissions sa on sa.id = rc.submission_a_id
    join public.submissions sb on sb.id = rc.submission_b_id
    where rc.id = card_expression_reactions.result_card_id
      and (sa.user_id = card_expression_reactions.user_id or sb.user_id = card_expression_reactions.user_id)
  )
);

create policy "expression_reactions_update_non_participant" on public.card_expression_reactions
for update to authenticated
using (
  card_expression_reactions.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(card_expression_reactions.result_card_id)
  and not exists (
    select 1
    from public.result_cards rc
    join public.submissions sa on sa.id = rc.submission_a_id
    join public.submissions sb on sb.id = rc.submission_b_id
    where rc.id = card_expression_reactions.result_card_id
      and (sa.user_id = card_expression_reactions.user_id or sb.user_id = card_expression_reactions.user_id)
  )
)
with check (
  card_expression_reactions.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and public.can_view_result_card(card_expression_reactions.result_card_id)
  and not exists (
    select 1
    from public.result_cards rc
    join public.submissions sa on sa.id = rc.submission_a_id
    join public.submissions sb on sb.id = rc.submission_b_id
    where rc.id = card_expression_reactions.result_card_id
      and (sa.user_id = card_expression_reactions.user_id or sb.user_id = card_expression_reactions.user_id)
  )
);

create policy "expression_reactions_delete_own_non_participant" on public.card_expression_reactions
for delete to authenticated
using (
  card_expression_reactions.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
);
