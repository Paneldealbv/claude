-- =============================================================================
-- 0010 · Account verwijderen terwijl je de laatste eigenaar bent
-- =============================================================================
-- De regel "een project houdt altijd een eigenaar" (0002) blokkeerde het
-- verwijderen van een account dat de enige eigenaar van een project is.
-- Nieuwe regel:
--   * Zolang het account bestaat, blijft de bescherming gelden (je kunt jezelf
--     als laatste eigenaar niet uit het project halen of degraderen).
--   * Wordt het account zelf verwijderd, dan:
--       - wordt het langst aanwezige andere lid eigenaar, of
--       - als er geen andere leden zijn, wordt het project met al zijn
--         gegevens verwijderd (niemand kan er dan nog bij).
-- =============================================================================

create or replace function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'eigenaar'
     and (tg_op = 'DELETE' or new.role <> 'eigenaar')
     -- het project bestaat nog (anders wordt het hele project verwijderd)
     and exists (select 1 from public.projects p where p.id = old.project_id)
     -- het account bestaat nog (anders: zie private.handle_owner_account_deleted)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.project_members m
       where m.project_id = old.project_id
         and m.role = 'eigenaar'
         and m.user_id <> old.user_id
     )
  then
    raise exception 'Een project moet minstens één eigenaar houden'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create function private.handle_owner_account_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opvolger uuid;
begin
  -- Alleen als het account zelf is verwijderd en er geen eigenaar meer over is.
  if old.role <> 'eigenaar'
     or exists (select 1 from auth.users u where u.id = old.user_id)
     or not exists (select 1 from public.projects p where p.id = old.project_id)
     or exists (
       select 1 from public.project_members m
       where m.project_id = old.project_id and m.role = 'eigenaar'
     )
  then
    return null;
  end if;

  select m.user_id into v_opvolger
  from public.project_members m
  where m.project_id = old.project_id
  order by m.created_at, m.user_id
  limit 1;

  if v_opvolger is not null then
    update public.project_members
    set role = 'eigenaar'
    where project_id = old.project_id and user_id = v_opvolger;

    insert into public.activity_log (project_id, user_id, action, table_name, record_id)
    values (old.project_id, v_opvolger, 'eigenaar_overgenomen', 'project_members', null);
  else
    delete from public.projects where id = old.project_id;
  end if;

  return null;
end;
$$;

revoke all on function private.handle_owner_account_deleted() from public, anon, authenticated;

create trigger project_members_owner_account_deleted
  after delete on public.project_members
  for each row execute function private.handle_owner_account_deleted();
