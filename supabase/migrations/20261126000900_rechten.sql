-- =============================================================================
-- 0009 · Expliciete tabelrechten voor ingelogde gebruikers
-- =============================================================================
-- Nieuwe Supabase-projecten geven ingelogde gebruikers (authenticated)
-- standaard GEEN lees- of schrijfrechten op nieuwe tabellen, wel TRUNCATE,
-- REFERENCES en TRIGGER. Deze migratie:
--   1. trekt TRUNCATE/REFERENCES/TRIGGER in (TRUNCATE omzeilt RLS);
--   2. geeft per tabel precies de rechten die de app nodig heeft;
--   3. laat technische kolommen (id, project_id, created_by, created_at)
--      na het aanmaken niet meer wijzigen;
--   4. vult created_by altijd met de ingelogde gebruiker.
-- Row Level Security blijft bepalen WELKE rijen iemand mag zien of wijzigen.
-- =============================================================================

-- 1. Gevaarlijke of overbodige rechten intrekken ------------------------------
revoke truncate, references, trigger on all tables in schema public
  from authenticated, anon;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from authenticated, anon;

-- 2. Projectgegevens: lezen, toevoegen, wijzigen, verwijderen (via RLS) --------
do $$
declare
  t text;
  kolommen text;
begin
  foreach t in array array[
    'categories', 'rooms', 'suppliers', 'files',
    'budget_lines', 'quotes', 'quote_lines',
    'contracts', 'contract_lines', 'contract_changes', 'contract_installments',
    'cost_documents', 'cost_lines', 'room_allocations', 'payments',
    'funding_sources', 'depot_claims', 'document_extractions'
  ]
  loop
    execute format('grant select, insert, delete on public.%I to authenticated', t);

    -- Wijzigen: alle kolommen behalve de technische.
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into kolommen
    from information_schema.columns
    where table_schema = 'public' and table_name = t
      and column_name not in ('id', 'project_id', 'created_by', 'created_at');
    execute format('revoke update on public.%I from authenticated', t);
    execute format('grant update (%s) on public.%I to authenticated', kolommen, t);
  end loop;
end
$$;

-- 3. Toegangstabellen: alleen wat de app nodig heeft ---------------------------
-- Aanmaken van projecten, lidmaatschappen en uitnodigingen gaat uitsluitend
-- via de functies create_project, create_invite en accept_invite.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, delete on public.projects to authenticated;
grant update (name, address, expected_completion) on public.projects to authenticated;

grant select, delete on public.project_members to authenticated;
grant update (role) on public.project_members to authenticated;

grant select on public.project_invites to authenticated;

grant select, insert on public.activity_log to authenticated;
grant usage on sequence public.activity_log_id_seq to authenticated;

-- 4. created_by altijd = de ingelogde gebruiker -------------------------------
create function private.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Alleen bij verzoeken van een ingelogde gebruiker; migraties en
  -- beheertaken (zonder gebruiker) laten de waarde ongemoeid.
  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.set_created_by() from public, anon, authenticated;

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'created_by'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger %I before insert on public.%I
         for each row execute function private.set_created_by()',
      t || '_created_by', t);
  end loop;
end
$$;
