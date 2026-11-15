begin;

create schema if not exists harvesthub_private;
revoke all on schema harvesthub_private from public, anon;
grant usage on schema harvesthub_private to authenticated;

create function harvesthub_private.delete_alliance(target_alliance_id uuid, confirmation_name text)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  actual_name text;
begin
  if auth.uid() is null or not public.is_actual_alliance_owner(target_alliance_id) then
    raise exception 'Удалить союз может только текущий владелец' using errcode = '42501';
  end if;

  select a.name into actual_name from public.alliances a
  where a.id = target_alliance_id for update;

  if not found or not public.is_actual_alliance_owner(target_alliance_id) then
    raise exception 'Удалить союз может только текущий владелец' using errcode = '42501';
  end if;
  if confirmation_name is distinct from actual_name then
    raise exception 'Название союза изменилось или введено неверно' using errcode = '22023';
  end if;

  delete from public.alliances where id = target_alliance_id;
end;
$function$;
revoke all on function harvesthub_private.delete_alliance(uuid, text) from public, anon, authenticated;
grant execute on function harvesthub_private.delete_alliance(uuid, text) to authenticated;

create function public.delete_alliance(target_alliance_id uuid, confirmation_name text)
returns void
language sql security invoker set search_path = ''
as $function$
  select harvesthub_private.delete_alliance(target_alliance_id, confirmation_name);
$function$;
revoke all on function public.delete_alliance(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_alliance(uuid, text) to authenticated;

commit;
