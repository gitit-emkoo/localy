-- Global board: authenticated users can read rows needed to render open result_cards
-- (submissions, teams, storage paths, teammate profiles on those cards).
-- Team-only policies from 004 blocked non-members from assembling the feed.

create or replace function public.is_profile_on_public_result_card(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions s
    join public.result_cards rc
      on rc.status = 'open'
     and (rc.submission_a_id = s.id or rc.submission_b_id = s.id)
    where s.user_id = target_profile_id
  );
$$;

revoke all on function public.is_profile_on_public_result_card(uuid) from public;
grant execute on function public.is_profile_on_public_result_card(uuid) to authenticated;

drop policy if exists "profiles_select_open_board" on public.user_profiles;
create policy "profiles_select_open_board" on public.user_profiles
for select to authenticated
using (public.is_profile_on_public_result_card(id));

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
  or exists (
    select 1
    from public.result_cards rc
    where rc.status = 'open'
      and (rc.submission_a_id = submissions.id or rc.submission_b_id = submissions.id)
  )
);

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
  or exists (
    select 1
    from public.result_cards rc
    where rc.team_id = teams.id
      and rc.status = 'open'
  )
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
    or exists (
      select 1
      from public.result_cards rc
      where rc.status = 'open'
        and rc.team_id::text = split_part(name, '/', 1)
    )
  )
);
