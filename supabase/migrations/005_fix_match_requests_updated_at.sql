-- Fix: match_requests trigger uses public.set_updated_at(), so updated_at column is required.
-- Apply for already-provisioned DBs created before this fix.

alter table public.match_requests
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_match_requests_updated_at on public.match_requests;
create trigger trg_match_requests_updated_at
before update on public.match_requests
for each row execute function public.set_updated_at();
