-- Phone/browser crash reports from the game's map debugger (src/mapdbg.js). Insert-only for the public client via the
-- report_crash RPC (size-capped, rate-limited by report id uniqueness); nobody can read them with the publishable key.
create table if not exists public.crash_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  rid text not null unique,
  build text,
  ua text,
  why text,
  report jsonb not null
);
alter table public.crash_reports enable row level security;
revoke all on public.crash_reports from anon, authenticated;
create or replace function public.report_crash(p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p is null or length(p::text) > 400000 then return false; end if;
  insert into public.crash_reports(rid, build, ua, why, report)
  values (left(coalesce(p->>'rid', md5(p::text)), 64), left(p#>>'{hdr,build}', 40), left(p#>>'{hdr,ua}', 300), left(p->>'why', 40), p)
  on conflict (rid) do nothing;
  return true;
end $$;
revoke all on function public.report_crash(jsonb) from public;
grant execute on function public.report_crash(jsonb) to anon, authenticated;
