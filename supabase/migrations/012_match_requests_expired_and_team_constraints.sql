-- match_requests: expired 상태 + 활성 요청만 (matching|matched) 유일
-- teams: pair 정규화(user_a < user_b) + mission당 유저 1팀 + pair 중복 방지

-- 1) match_requests.status 에 expired 추가
alter table public.match_requests
  drop constraint if exists match_requests_status_check;

alter table public.match_requests
  add constraint match_requests_status_check
  check (status in ('idle', 'matching', 'matched', 'failed', 'cancelled', 'expired'));

-- 2) 기존 (user_id, mission_id) 전역 유니크 제거 → 히스토리 다중 행 허용
alter table public.match_requests
  drop constraint if exists match_requests_user_id_mission_id_key;

-- 3) 활성 matching|matched 만 user_id+mission_id 유일
drop index if exists public.match_requests_one_active_per_user_mission;

create unique index match_requests_one_active_per_user_mission
  on public.match_requests (user_id, mission_id)
  where status in ('matching', 'matched');

-- 4) teams: user_a_id < user_b_id 로 정규화 후 제약 추가
update public.teams
set
  user_a_id = case when user_a_id < user_b_id then user_a_id else user_b_id end,
  user_b_id = case when user_a_id < user_b_id then user_b_id else user_a_id end,
  user_a_country_code = case when user_a_id < user_b_id then user_a_country_code else user_b_country_code end,
  user_b_country_code = case when user_a_id < user_b_id then user_b_country_code else user_a_country_code end
where user_a_id > user_b_id;

alter table public.teams
  add constraint teams_ordered_pair check (user_a_id < user_b_id);

drop index if exists public.teams_mission_user_a;
drop index if exists public.teams_mission_user_b;
drop index if exists public.teams_mission_pair;

create unique index teams_mission_user_a
  on public.teams (mission_id, user_a_id);

create unique index teams_mission_user_b
  on public.teams (mission_id, user_b_id);

create unique index teams_mission_pair
  on public.teams (mission_id, user_a_id, user_b_id);
