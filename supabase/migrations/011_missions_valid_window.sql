-- Global active mission window (UTC instants). Client must not pick mission by local calendar.

alter table public.missions
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz;

-- Backfill: each mission_date cycle starts at 12:00 UTC (기획 UTC 12:00 경계와 정렬)
update public.missions
set
  valid_from = ((mission_date::text || ' 12:00:00+00')::timestamptz),
  valid_to = ((mission_date::text || ' 12:00:00+00')::timestamptz) + interval '24 hours'
where valid_from is null;

alter table public.missions
  alter column valid_from set not null,
  alter column valid_to set not null;

drop index if exists public.missions_one_published_per_date;

create index if not exists idx_missions_active_window
  on public.missions (status, valid_from, valid_to)
  where status = 'published';

-- Single source of truth: server now() decides active mission (at most one row expected)
create or replace function public.get_active_mission()
returns public.missions
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.missions;
begin
  select m.*
  into strict r
  from public.missions m
  where m.status = 'published'
    and m.valid_from <= now()
    and m.valid_to > now()
  order by m.valid_from desc
  limit 1;
  return r;
exception
  when no_data_found then
    return null;
end;
$$;

revoke all on function public.get_active_mission() from public;
grant execute on function public.get_active_mission() to anon, authenticated;

-- Reject submissions unless mission_id is the currently active published mission (server time)
create or replace function public.enforce_submission_active_mission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.missions mm
    where mm.id = new.mission_id
      and mm.status = 'published'
      and mm.valid_from <= now()
      and mm.valid_to > now()
  ) then
    raise exception 'mission_not_active' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_submissions_active_mission on public.submissions;
create trigger trg_submissions_active_mission
before insert or update of mission_id on public.submissions
for each row execute function public.enforce_submission_active_mission();

revoke all on function public.enforce_submission_active_mission() from public;
