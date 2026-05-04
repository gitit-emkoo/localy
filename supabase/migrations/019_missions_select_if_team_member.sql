-- Allow reading a mission row when the user is (or was) on a team for that mission,
-- so deep links to /team/[id] keep working after the mission is no longer in the published window.

drop policy if exists "missions_select_if_team_member" on public.missions;
create policy "missions_select_if_team_member" on public.missions
for select to authenticated
using (
  exists (
    select 1
    from public.teams t
    join public.user_profiles me on me.auth_user_id = auth.uid()
    where t.mission_id = missions.id
      and (me.id = t.user_a_id or me.id = t.user_b_id)
  )
);
