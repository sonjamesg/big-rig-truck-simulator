-- Big Rig accounts: name + 4-digit PIN, sessions, cloud save. All access via SECURITY DEFINER RPCs.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.players(
  id bigint generated always as identity primary key,
  username text not null,
  display_name text not null,
  pin_hash text not null,
  fails int not null default 0,
  lock_until timestamptz,
  is_admin boolean not null default false,
  save jsonb,
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create unique index if not exists players_username_key on public.players (lower(username));

create table if not exists public.sessions(
  token_hash text primary key,
  player_id bigint not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists sessions_player on public.sessions(player_id);

alter table public.players enable row level security;
alter table public.sessions enable row level security;
revoke all on public.players, public.sessions from anon, authenticated;

create or replace function public._norm(n text) returns text language sql immutable
as $$ select regexp_replace(btrim(coalesce(n,'')), '\s+', ' ', 'g') $$;

create or replace function public._sess(tok text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare pid bigint;
begin
  delete from sessions where last_seen < now() - interval '24 hours';
  update sessions set last_seen = now()
   where token_hash = encode(digest(coalesce(tok,''),'sha256'),'hex')
   returning player_id into pid;
  return pid;
end $$;

create or replace function public._new_session(pid bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text := encode(gen_random_bytes(32),'hex');
begin
  insert into sessions(token_hash, player_id) values (encode(digest(tok,'sha256'),'hex'), pid);
  update players set last_login = now() where id = pid;
  return tok;
end $$;

create or replace function public.name_check(name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n text := _norm(name);
begin
  if char_length(n) < 1 or char_length(n) > 16 then return jsonb_build_object('ok',false,'error','Name must be 1-16 characters'); end if;
  return jsonb_build_object('ok',true,'name',n,'exists', exists(select 1 from players where lower(username)=lower(n)));
end $$;

create or replace function public.register(name text, pin text, pin_confirm text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n text := _norm(name); pid bigint;
begin
  if char_length(n) < 1 or char_length(n) > 16 then return jsonb_build_object('ok',false,'error','Name must be 1-16 characters'); end if;
  if coalesce(pin,'') !~ '^[0-9]{4}$' then return jsonb_build_object('ok',false,'error','PIN must be exactly 4 digits'); end if;
  if pin is distinct from pin_confirm then return jsonb_build_object('ok',false,'error','PINs do not match'); end if;
  begin
    insert into players(username, display_name, pin_hash) values (n, n, crypt(pin, gen_salt('bf'))) returning id into pid;
  exception when unique_violation then
    return jsonb_build_object('ok',false,'error','Name already taken');
  end;
  return jsonb_build_object('ok',true,'token',_new_session(pid),'name',n,'is_admin',false);
end $$;

create or replace function public.verify(name text, pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare p players; n text := _norm(name);
begin
  select * into p from players where lower(username)=lower(n) for update;
  if not found then return jsonb_build_object('ok',false,'error','No such account'); end if;
  if p.lock_until is not null and p.lock_until > now() then
    return jsonb_build_object('ok',false,'error','Account locked','locked_until',p.lock_until,'attempts_left',0); end if;
  if coalesce(pin,'') ~ '^[0-9]{4}$' and p.pin_hash = crypt(pin, p.pin_hash) then
    update players set fails=0, lock_until=null where id=p.id;
    return jsonb_build_object('ok',true,'token',_new_session(p.id),'name',p.display_name,'is_admin',p.is_admin);
  end if;
  if p.lock_until is not null then p.fails := 0; end if; -- lock expired: fresh 4 attempts
  p.fails := p.fails + 1;
  if p.fails >= 4 then
    update players set fails=0, lock_until=now()+interval '24 hours' where id=p.id;
    return jsonb_build_object('ok',false,'error','Wrong PIN - account locked for 24h','locked_until',now()+interval '24 hours','attempts_left',0);
  end if;
  update players set fails=p.fails, lock_until=null where id=p.id;
  return jsonb_build_object('ok',false,'error','Wrong PIN','attempts_left',4-p.fails);
end $$;

create or replace function public.session_touch(token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare pid bigint := _sess(token); p players;
begin
  if pid is null then return jsonb_build_object('ok',false,'error','Session expired'); end if;
  select * into p from players where id=pid;
  return jsonb_build_object('ok',true,'name',p.display_name,'is_admin',p.is_admin);
end $$;

create or replace function public.logout(token text) returns jsonb
language sql security definer set search_path = public, extensions as $$
  delete from sessions where token_hash = encode(digest(coalesce(token,''),'sha256'),'hex');
  select jsonb_build_object('ok',true);
$$;

create or replace function public.load_save(token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare pid bigint := _sess(token); p players;
begin
  if pid is null then return jsonb_build_object('ok',false,'error','Session expired'); end if;
  select * into p from players where id=pid;
  return jsonb_build_object('ok',true,'save',p.save,'is_admin',p.is_admin,'name',p.display_name);
end $$;

create or replace function public.store_save(token text, data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare pid bigint := _sess(token);
begin
  if pid is null then return jsonb_build_object('ok',false,'error','Session expired'); end if;
  if pg_column_size(data) > 1000000 then return jsonb_build_object('ok',false,'error','Save too large'); end if;
  update players set save=data where id=pid;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public._norm(text), public._sess(text), public._new_session(bigint) from public, anon, authenticated;
revoke all on function public.name_check(text), public.register(text,text,text), public.verify(text,text),
  public.session_touch(text), public.logout(text), public.load_save(text), public.store_save(text,jsonb) from public;
grant execute on function public.name_check(text), public.register(text,text,text), public.verify(text,text),
  public.session_touch(text), public.logout(text), public.load_save(text), public.store_save(text,jsonb) to anon, authenticated;
