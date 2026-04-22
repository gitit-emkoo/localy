-- run_matchmaking_tick: 만료 처리 UPDATE 에서 RETURNING INTO 는
-- 여러 행이 갱신될 때 PL/pgSQL 에서 문제를 일으킬 수 있어 ROW_COUNT 로 대체합니다.

create or replace function public.run_matchmaking_tick()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
  r1_id uuid;
  r1_uid uuid;
  r2_id uuid;
  r2_uid uuid;
  new_team uuid;
  pairs integer := 0;
begin
  perform pg_advisory_xact_lock(84206031);

  for mid in
    select distinct mr.mission_id
    from public.match_requests mr
    where mr.status = 'matching'
  loop
    loop
      select
        mr1.id,
        mr1.user_id,
        mr2.id,
        mr2.user_id
      into r1_id, r1_uid, r2_id, r2_uid
      from public.match_requests mr1
      join public.user_profiles p1 on p1.id = mr1.user_id
      join public.match_requests mr2
        on mr2.mission_id = mr1.mission_id
        and mr2.id > mr1.id
      join public.user_profiles p2 on p2.id = mr2.user_id
      where mr1.mission_id = mid
        and mr1.status = 'matching'
        and mr2.status = 'matching'
        and p1.country_code <> p2.country_code
      order by
        least(mr1.requested_at, mr2.requested_at) asc,
        greatest(mr1.requested_at, mr2.requested_at) asc,
        mr1.id asc,
        mr2.id asc
      limit 1;

      exit when not found;

      insert into public.teams (
        mission_id,
        user_a_id,
        user_b_id,
        user_a_country_code,
        user_b_country_code
      )
      values (
        mid,
        least(r1_uid, r2_uid),
        greatest(r1_uid, r2_uid),
        (select country_code from public.user_profiles where id = least(r1_uid, r2_uid)),
        (select country_code from public.user_profiles where id = greatest(r1_uid, r2_uid))
      )
      returning id into new_team;

      update public.match_requests
      set
        status = 'matched',
        team_id = new_team,
        matched_at = now(),
        failed_at = null
      where id in (r1_id, r2_id);

      pairs := pairs + 1;
    end loop;
  end loop;

  update public.match_requests mr
  set
    status = 'expired',
    failed_at = null
  from public.missions m
  where mr.mission_id = m.id
    and mr.status = 'matching'
    and m.valid_to <= now();

  return pairs;
end;
$$;

revoke all on function public.run_matchmaking_tick() from public;
grant execute on function public.run_matchmaking_tick() to service_role;
