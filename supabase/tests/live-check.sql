-- =============================================================================
-- Live beveiligingscontrole op de echte Supabase-database.
--
-- Draait volledig in één transactie die ALTIJD wordt teruggedraaid: het blok
-- eindigt bewust met een exception. Testgebruikers en testgegevens blijven
-- dus nooit achter. Uitvoeren met:  npm run supabase -- livetest
-- =============================================================================
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  pid uuid;
  tok text;
  n bigint;
  ok text[] := '{}';
  sfx text := replace(gen_random_uuid()::text, '-', '');

  procedure_als constant text := 'select set_config(''request.jwt.claims'', $1, true), set_config(''role'', ''authenticated'', true)';
begin
  -- Structuur -----------------------------------------------------------------
  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  if n > 0 then raise exception 'MISLUKT: % tabel(len) zonder RLS', n; end if;
  ok := array_append(ok, 'RLS op alle tabellen');

  select count(*) into n from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';
  if n > 0 then raise exception 'MISLUKT: anon heeft % tabelrechten', n; end if;
  ok := array_append(ok, 'anon heeft geen tabelrechten');

  select count(*) into n from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public'
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
  if n > 0 then raise exception 'MISLUKT: authenticated heeft % TRUNCATE/TRIGGER-rechten', n; end if;
  ok := array_append(ok, 'geen TRUNCATE/TRIGGER voor ingelogde gebruikers');

  select count(*) into n from storage.buckets where id = 'documenten' and not public;
  if n <> 1 then raise exception 'MISLUKT: privé bucket documenten ontbreekt'; end if;
  ok := array_append(ok, 'privé bucket documenten');

  select count(*) into n from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and policyname like 'documenten %';
  if n <> 4 then raise exception 'MISLUKT: % opslagregels i.p.v. 4', n; end if;
  ok := array_append(ok, 'opslagregels aanwezig');

  -- Testgebruikers (worden teruggedraaid) --------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (a, 'live-a-' || sfx || '@voorbeeld.invalid', now(), '{"full_name":"Test A"}', 'authenticated', 'authenticated'),
         (b, 'live-b-' || sfx || '@voorbeeld.invalid', now(), '{"full_name":"Test B"}', 'authenticated', 'authenticated'),
         (c, 'live-c-' || sfx || '@voorbeeld.invalid', now(), '{"full_name":"Test C"}', 'authenticated', 'authenticated');

  -- A: project, uitnodiging, gegevens ------------------------------------------
  execute procedure_als using json_build_object('sub', a, 'role', 'authenticated')::text;
  pid := public.create_project('Live-test');
  select i.token into tok from public.create_invite(pid, 'live-b-' || sfx || '@voorbeeld.invalid', 'bewerker') i;
  insert into public.categories (project_id, name) values (pid, 'Keuken');
  insert into public.suppliers (project_id, name) values (pid, 'Leverancier');

  -- B accepteert en ziet hetzelfde ---------------------------------------------
  execute procedure_als using json_build_object('sub', b, 'role', 'authenticated')::text;
  if public.accept_invite(tok) <> pid then raise exception 'MISLUKT: B kon niet accepteren'; end if;
  select count(*) into n from public.categories where project_id = pid;
  if n <> 1 then raise exception 'MISLUKT: B ziet % categorieën i.p.v. 1', n; end if;
  select count(*) into n from public.suppliers where project_id = pid;
  if n <> 1 then raise exception 'MISLUKT: B ziet % leveranciers i.p.v. 1', n; end if;
  select count(*) into n from public.project_members where project_id = pid;
  if n <> 2 then raise exception 'MISLUKT: B ziet % leden i.p.v. 2', n; end if;
  ok := array_append(ok, 'B (uitgenodigd) ziet dezelfde gegevens als A');

  -- C ziet en wijzigt niets ----------------------------------------------------
  execute procedure_als using json_build_object('sub', c, 'role', 'authenticated')::text;
  select (select count(*) from public.projects where id = pid)
       + (select count(*) from public.categories where project_id = pid)
       + (select count(*) from public.suppliers where project_id = pid)
       + (select count(*) from public.project_members where project_id = pid)
       + (select count(*) from public.project_invites where project_id = pid)
       + (select count(*) from public.activity_log where project_id = pid)
    into n;
  if n <> 0 then raise exception 'MISLUKT: C ziet % rijen van het project', n; end if;
  ok := array_append(ok, 'C (geen toegang) ziet niets');

  update public.categories set name = 'gehackt' where project_id = pid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'MISLUKT: C kon % categorieën wijzigen', n; end if;
  begin
    insert into public.categories (project_id, name) values (pid, 'Inbraak');
    raise exception 'MISLUKT: C kon een categorie toevoegen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_invite(tok);
    raise exception 'MISLUKT: C kon een gebruikte uitnodiging gebruiken';
  exception when others then
    if sqlerrm like 'MISLUKT%' then raise; end if;
  end;
  ok := array_append(ok, 'C kan niets toevoegen, wijzigen of overnemen');

  -- Niet ingelogd --------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform count(*) from public.projects;
    raise exception 'MISLUKT: anon kan projecten lezen';
  exception when insufficient_privilege then null;
  end;
  ok := array_append(ok, 'niet ingelogd: geen toegang');

  raise exception 'LIVE-TEST GESLAAGD (% controles, alles teruggedraaid): %',
    array_length(ok, 1), array_to_string(ok, '; ');
end
$$;
