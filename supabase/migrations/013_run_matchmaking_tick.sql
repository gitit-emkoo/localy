-- 서버 측 매칭 1틱: status=matching 인 요청만, 서로 다른 country_code 인 유저끼리 짝 지음.
-- teams: user_a_id < user_b_id 정규화, match_requests → matched + team_id.
-- Edge / cron 은 service_role 로만 RPC 호출 (일반 클라이언트는 EXECUTE 권한 없음).

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
  -- 동시에 두 워커가 돌아도 짝 선택·삽입이 섞이지 않도록 한 트랜잭션 안에서 직렬화
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

  return pairs;
end;
$$;

revoke all on function public.run_matchmaking_tick() from public;
grant execute on function public.run_matchmaking_tick() to service_role;
