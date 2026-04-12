-- Fix: infinite recursion detected in policy for relation "result_cards"
-- Cause: teams_select_member (007) referenced result_cards inside EXISTS, while
-- result_cards_select references teams → circular RLS evaluation.
-- Fix: read result_cards inside SECURITY DEFINER helpers (bypass RLS) instead of inline EXISTS.

create or replace function public.team_has_open_result_card(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.result_cards rc
    where rc.team_id = p_team_id
      and rc.status = 'open'
  );
$$;

revoke all on function public.team_has_open_result_card(uuid) from public;
grant execute on function public.team_has_open_result_card(uuid) to authenticated;

create or replace function public.submission_is_on_open_result_card(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.result_cards rc
    where rc.status = 'open'
      and (rc.submission_a_id = p_submission_id or rc.submission_b_id = p_submission_id)
  );
$$;

revoke all on function public.submission_is_on_open_result_card(uuid) from public;
grant execute on function public.submission_is_on_open_result_card(uuid) to authenticated;

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
  or public.team_has_open_result_card(teams.id)
);

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
  or public.submission_is_on_open_result_card(submissions.id)
);

drop policy if exists "mission_photos_select_team" on storage.objects;
create policy "mission_photos_select_team"
on storage.objects for select to authenticated
using (
  bucket_id = 'mission-photos'
  and (
    exists (
      select 1
      from public.teams t
      join public.user_profiles me on me.auth_user_id = auth.uid()
      where t.id::text = split_part(name, '/', 1)
        and (me.id = t.user_a_id or me.id = t.user_b_id)
    )
    or public.team_has_open_result_card((split_part(name, '/', 1))::uuid)
  )
);
