create schema if not exists harvesthub_private;
revoke all on schema harvesthub_private from public;
grant usage on schema harvesthub_private to anon, authenticated;
create table public.state_maps (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<1000000),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.state_maps enable row level security;
revoke all on public.state_maps from anon,authenticated;
grant select on public.state_maps to authenticated;
create policy state_maps_owner_read on public.state_maps for select to authenticated using((select auth.uid())=owner_id);
create table harvesthub_private.state_map_codes (
 owner_id uuid primary key references public.state_maps(owner_id) on delete cascade,
 code text not null unique check(code~'^[0-9]{12}$'),
 code_hash text not null unique
);
create table harvesthub_private.state_map_connections (
 viewer_id uuid not null references auth.users(id) on delete cascade,
 owner_id uuid not null references public.state_maps(owner_id) on delete cascade,
 code_hash text not null,
 primary key(viewer_id,owner_id)
);
alter table harvesthub_private.state_map_codes enable row level security;
alter table harvesthub_private.state_map_connections enable row level security;
revoke all on harvesthub_private.state_map_codes,harvesthub_private.state_map_connections from public,anon,authenticated;

create function harvesthub_private.save_state_map(p_payload jsonb,p_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare result integer; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Войдите в аккаунт для сохранения.';end if;
 if (p_payload->>'version') is distinct from '2' or jsonb_typeof(p_payload->'alliances') is distinct from 'array' or jsonb_typeof(p_payload->'actions') is distinct from 'array' or jsonb_typeof(p_payload->'owners') is distinct from 'object' then raise exception 'Неверный формат карты.';end if;
 if p_revision=0 then
  insert into public.state_maps(owner_id,payload) values(u,p_payload) on conflict do nothing returning revision into result;
 else
  update public.state_maps set payload=p_payload,revision=revision+1,updated_at=now() where owner_id=u and revision=p_revision returning revision into result;
 end if;
 if result is null then raise exception 'Карта изменена в другой вкладке. Обновите страницу перед сохранением.';end if;
 return result;
end $$;
create function public.save_state_map(p_payload jsonb,p_revision integer) returns integer language sql security invoker set search_path='' as $$select harvesthub_private.save_state_map(p_payload,p_revision)$$;

create function harvesthub_private.state_map_code(p_rotate boolean) returns text
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); value text;
begin
 if u is null or not exists(select 1 from public.state_maps where owner_id=u) then raise exception 'Сначала сохраните карту в аккаунт.';end if;
 perform 1 from public.state_maps where owner_id=u for update;
 select code into value from harvesthub_private.state_map_codes where owner_id=u;
 if value is not null and not p_rotate then return value;end if;
 loop
  value:=lpad(((('x'||substr(encode(extensions.gen_random_bytes(8),'hex'),1,15))::bit(60)::bigint)%1000000000000)::text,12,'0');
  exit when not exists(select 1 from harvesthub_private.state_map_codes where code=value);
 end loop;
 insert into harvesthub_private.state_map_codes(owner_id,code,code_hash) values(u,value,encode(extensions.digest(value,'sha256'),'hex'))
 on conflict(owner_id) do update set code=excluded.code,code_hash=excluded.code_hash;
 delete from harvesthub_private.state_map_connections where owner_id=u;
 return value;
end $$;
create function public.state_map_code(p_rotate boolean default false) returns text language sql security invoker set search_path='' as $$select harvesthub_private.state_map_code(p_rotate)$$;

create function harvesthub_private.read_state_map(p_code text,p_owner uuid,p_remember boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; hash text; u uuid:=auth.uid(); result jsonb;
begin
 if p_code is not null and p_code~'^[0-9]{12}$' then
  hash:=encode(extensions.digest(p_code,'sha256'),'hex');
  select owner_id into target from harvesthub_private.state_map_codes where code_hash=hash;
 elsif u is not null and p_owner is not null then
  select c.owner_id into target from harvesthub_private.state_map_connections c join harvesthub_private.state_map_codes k on k.owner_id=c.owner_id and k.code_hash=c.code_hash where c.viewer_id=u and c.owner_id=p_owner;
 end if;
 if target is null then raise exception 'Код не найден или доступ отозван.';end if;
 if p_remember and u is not null and hash is not null and target<>u then
  insert into harvesthub_private.state_map_connections(viewer_id,owner_id,code_hash) values(u,target,hash) on conflict(viewer_id,owner_id) do update set code_hash=excluded.code_hash;
 end if;
 select jsonb_build_object('owner',owner_id,'payload',payload,'revision',revision,'updated_at',updated_at) into result from public.state_maps where owner_id=target;
 return result;
end $$;
create function public.read_state_map(p_code text default null,p_owner uuid default null,p_remember boolean default false) returns jsonb language sql security invoker set search_path='' as $$select harvesthub_private.read_state_map(p_code,p_owner,p_remember)$$;

create function harvesthub_private.state_map_connections() returns jsonb
language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('owner',c.owner_id,'name',coalesce(m.payload->>'title','Карта штата'))),'[]'::jsonb)
 from harvesthub_private.state_map_connections c join harvesthub_private.state_map_codes k on k.owner_id=c.owner_id and k.code_hash=c.code_hash join public.state_maps m on m.owner_id=c.owner_id where c.viewer_id=(select auth.uid())
$$;
create function public.state_map_connections() returns jsonb language sql security invoker set search_path='' as $$select harvesthub_private.state_map_connections()$$;

revoke all on function harvesthub_private.save_state_map(jsonb,integer),public.save_state_map(jsonb,integer),harvesthub_private.state_map_code(boolean),public.state_map_code(boolean),harvesthub_private.read_state_map(text,uuid,boolean),public.read_state_map(text,uuid,boolean),harvesthub_private.state_map_connections(),public.state_map_connections() from public,anon,authenticated;
grant execute on function harvesthub_private.save_state_map(jsonb,integer),public.save_state_map(jsonb,integer),harvesthub_private.state_map_code(boolean),public.state_map_code(boolean),harvesthub_private.state_map_connections(),public.state_map_connections() to authenticated;
grant execute on function harvesthub_private.read_state_map(text,uuid,boolean),public.read_state_map(text,uuid,boolean) to anon,authenticated;
