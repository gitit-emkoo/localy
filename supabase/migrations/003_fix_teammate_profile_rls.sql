-- Fix: profiles_select_teammate could cause infinite recursion in RLS when
-- user_profiles is joined inside a policy ON user_profiles (bootstrap + upsert .select() fail).

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
