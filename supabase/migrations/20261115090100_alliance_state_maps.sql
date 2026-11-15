begin;

create table public.state_map_territories (
  map_key text not null check (map_key ~ '^[a-z0-9_-]{1,64}$'),
  territory_key text not null check (territory_key ~ '^[a-z0-9_-]{1,64}$'),
  primary key (map_key, territory_key)
);

create table public.alliance_state_map_sides (
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  map_key text not null check (map_key ~ '^[a-z0-9_-]{1,64}$'),
  id uuid not null default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  primary key (alliance_id, map_key, id)
);
create unique index alliance_state_map_sides_name_key
  on public.alliance_state_map_sides (alliance_id, map_key, lower(name));

create table public.alliance_state_map_owners (
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  map_key text not null,
  territory_key text not null,
  side_id uuid not null,
  primary key (alliance_id, map_key, territory_key),
  foreign key (map_key, territory_key) references public.state_map_territories(map_key, territory_key),
  foreign key (alliance_id, map_key, side_id)
    references public.alliance_state_map_sides(alliance_id, map_key, id) on delete cascade
);
create index alliance_state_map_owners_side_idx
  on public.alliance_state_map_owners(alliance_id, map_key, side_id);

alter table public.state_map_territories enable row level security;
alter table public.alliance_state_map_sides enable row level security;
alter table public.alliance_state_map_owners enable row level security;
revoke all on public.state_map_territories, public.alliance_state_map_sides, public.alliance_state_map_owners from public, anon, authenticated;
grant select on public.state_map_territories, public.alliance_state_map_sides, public.alliance_state_map_owners to authenticated;
grant insert (alliance_id, map_key, name, color), update (color) on public.alliance_state_map_sides to authenticated;
grant insert (alliance_id, map_key, territory_key, side_id), update (side_id), delete on public.alliance_state_map_owners to authenticated;

create policy state_map_territories_read on public.state_map_territories for select to authenticated using (true);
create policy state_map_sides_read on public.alliance_state_map_sides for select to authenticated using (public.is_alliance_member(alliance_id));
create policy state_map_sides_add on public.alliance_state_map_sides for insert to authenticated with check (
  public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id) and
  exists (select 1 from public.state_map_territories t where t.map_key = alliance_state_map_sides.map_key)
);
create policy state_map_sides_edit on public.alliance_state_map_sides for update to authenticated
  using (public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id))
  with check (public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id));

create policy state_map_owners_read on public.alliance_state_map_owners for select to authenticated using (public.is_alliance_member(alliance_id));
create policy state_map_owners_add on public.alliance_state_map_owners for insert to authenticated
  with check (public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id));
create policy state_map_owners_edit on public.alliance_state_map_owners for update to authenticated
  using (public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id))
  with check (public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id));
create policy state_map_owners_remove on public.alliance_state_map_owners for delete to authenticated
  using (public.is_alliance_member(alliance_id) and public.can_edit_alliance(alliance_id));

create function public.set_state_map_owner(target_alliance_id uuid, target_map_key text, target_territory_key text, target_side_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_alliance_member(target_alliance_id) or not public.can_edit_alliance(target_alliance_id) then
    raise exception 'Изменять карту могут только редакторы этого штаба' using errcode = '42501';
  end if;
  if target_side_id is null then
    delete from public.alliance_state_map_owners
    where alliance_id = target_alliance_id and map_key = target_map_key and territory_key = target_territory_key;
  else
    insert into public.alliance_state_map_owners (alliance_id, map_key, territory_key, side_id)
    values (target_alliance_id, target_map_key, target_territory_key, target_side_id)
    on conflict (alliance_id, map_key, territory_key) do update set side_id = excluded.side_id;
  end if;
end;
$function$;
revoke all on function public.set_state_map_owner(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_state_map_owner(uuid, text, text, uuid) to authenticated;

commit;
