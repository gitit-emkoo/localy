-- 재매칭 테스트 전: 이전 팀 row 가 남아 있으면 teams 유니크에 걸려 워커(RPC)가 500 이 납니다.
-- match_requests 만 cancelled 로 돌리지 말고, 아래를 한 번 실행한 뒤 앱에서 다시 매칭 시작하세요.
--
-- 대상: 활성 미션 + 아래 두 이메일 중 하나라도 포함된 teams 행 삭제

with prof as (
  select p.id
  from public.user_profiles p
  join auth.users u on u.id = p.auth_user_id
  where u.email in ('cokwcc@gmail.com', 'kwcc2020@naver.com')
),
mid as (
  select (public.get_active_mission()).id as mission_id
)
delete from public.teams t
using mid
where t.mission_id = mid.mission_id
  and (t.user_a_id in (select id from prof) or t.user_b_id in (select id from prof));

-- 선택: 해당 미션·유저의 match_requests 를 cancelled 로 (이미 했다면 영향 없음)
-- update public.match_requests mr
-- set status = 'cancelled', team_id = null, matched_at = null, failed_at = null
-- from prof, mid
-- where mr.mission_id = mid.mission_id
--   and mr.user_id in (select id from prof)
--   and mr.status in ('matching', 'matched');
