-- One-off server-side cash grants: players.pending_cash is added to the live game by the client (claim_cash) and zeroed atomically,
-- so a running session's save can never overwrite a grant.
alter table public.players add column if not exists pending_cash numeric not null default 0;

create or replace function public.claim_cash(token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare pid bigint := _sess(token); amt numeric;
begin
  if pid is null then return jsonb_build_object('ok',false,'error','Session expired'); end if;
  with old as (select id, pending_cash from players where id=pid for update)
  update players p set pending_cash=0 from old where p.id=old.id and old.pending_cash<>0 returning old.pending_cash into amt;
  return jsonb_build_object('ok',true,'cash',coalesce(amt,0));
end $$;

revoke all on function public.claim_cash(text) from public;
grant execute on function public.claim_cash(text) to anon, authenticated;
