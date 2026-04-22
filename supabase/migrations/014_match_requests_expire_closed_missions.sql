-- Matchmaking tick v2:
-- 1) 기존과 동일하게 cross-country pair를 teams + match_requests.matched 로 반영
-- 2) valid_to 가 지난 미션에 대해 여전히 matching 인 요청은 expired 로 전환
--    (클라이언트는 expired 를 보고 재시도 버튼/문구를 다르게 노출)

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
  expired_count integer := 0;
begin
  -- 동시에 여러 워커가 돌더라도 한 번에 한 세션만 짝을 만들도록 보장
  perform pg_advisory_xact_lock(84206031);

  -- 1) cross-country matching pair 생성 (기존 013_run_matchmaking_tick 과 동일 로직)
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

  -- 2) 미션 유효 시간이 지난 matching 요청을 expired 로 전환
  update public.match_requests mr
  set
    status = 'expired',
    failed_at = null
  from public.missions m
  where mr.mission_id = m.id
    and mr.status = 'matching'
    and m.valid_to <= now()
  returning 1 into expired_count;

  -- TODO: expired_count 를 반환값에 합칠 수도 있지만, 현재는 "생성된 pair 개수" 정의 유지
  return pairs;
end;
$$;

revoke all on function public.run_matchmaking_tick() from public;
grant execute on function public.run_matchmaking_tick() to service_role;

