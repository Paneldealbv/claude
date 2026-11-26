-- =============================================================================
-- Beveiligingstests (RLS, rechten, uitnodigingen, opslag, controles)
--
-- Gebruikers:
--   A  eigenaar van het project
--   B  bewerker (via uitnodiging)
--   D  lezer (via uitnodiging)
--   C  heeft GEEN toegang tot het project (wel een eigen project)
--   E  e-mailadres nog niet bevestigd
--   anon  niet ingelogd
--
-- Uitvoeren: supabase/tests/run-local.sh (nooit op de echte database).
-- Elke geslaagde controle geeft "ok - …"; de eerste fout stopt het script.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

-- -----------------------------------------------------------------------------
-- Testhulpmiddelen
-- -----------------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

create function test.als(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end $$;

create function test.anoniem() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  perform set_config('role', 'anon', false);
end $$;

create function test.ok(p_check boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_check is distinct from true then
    raise exception 'MISLUKT - %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end $$;

-- Voert SQL uit en verwacht een fout (deferred controles direct afdwingen).
create function test.faalt(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  begin
    set constraints all immediate;
    execute p_sql;
  exception when others then
    raise notice 'ok - % (geweigerd: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'MISLUKT - % (werd NIET geweigerd)', p_label;
end $$;

-- Voert SQL uit en geeft het aantal geraakte rijen terug.
create function test.rijen(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  set constraints all immediate;
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Vingerafdruk van alles wat de huidige gebruiker kan zien, per tabel.
create function test.snapshot() returns jsonb
language plpgsql as $$
declare
  t text;
  r jsonb := '{}'::jsonb;
  n bigint;
  h text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  loop
    execute format(
      'select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L))
       from public.%I x', '|', '', t)
    into n, h;
    r := r || jsonb_build_object(t, jsonb_build_object('n', n, 'md5', h));
  end loop;
  return r;
end $$;

-- Aantal zichtbare rijen over alle tabellen, behalve het eigen profiel.
create function test.zichtbaar_buiten_eigen_profiel(p_snap jsonb) returns bigint
language sql as $$
  select coalesce(sum((v ->> 'n')::bigint), 0)
  from jsonb_each(p_snap) as e(k, v)
  where k <> 'profiles';
$$;

grant execute on all functions in schema test to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Vangnetten: geldt ook voor tabellen en functies die later worden toegevoegd
-- -----------------------------------------------------------------------------
select test.ok(not exists (
  select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'Row Level Security staat aan op ALLE tabellen in public');
select test.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                    where c like 'search_path=%')),
  'elke security-definer-functie heeft een vast search_path');
select test.ok(not exists (
  select 1 from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'),
  'niet-ingelogde bezoekers hebben op geen enkele tabel rechten');

-- -----------------------------------------------------------------------------
-- Gebruikers
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.nl', now(), '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'B@Test.nl', now(), '{"full_name":"Bram"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.nl', now(), '{"full_name":"Cas"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.nl', now(), '{"full_name":"Dewi"}'),
  ('00000000-0000-0000-0000-00000000000e', 'e@test.nl', null,  '{"full_name":"Eva"}');

\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
\set D '00000000-0000-0000-0000-00000000000d'
\set E '00000000-0000-0000-0000-00000000000e'

select test.ok((select count(*) from public.profiles) = 5,
  'profiel wordt automatisch aangemaakt bij registratie');
select test.ok((select email from public.profiles where id = :'B') = 'b@test.nl',
  'e-mailadres in profiel is in kleine letters');

-- =============================================================================
-- 1. Project aanmaken en uitnodigen
-- =============================================================================
select test.als(:'A');
select public.create_project('Kavel 14', 'Demostraat 1', '2027-05-15') as pid \gset

select test.ok((select role from public.project_members
                where project_id = :'pid' and user_id = :'A') = 'eigenaar',
  'aanmaker wordt eigenaar');

select token as tok_b from public.create_invite(:'pid', 'b@test.nl', 'bewerker') \gset
select token as tok_d from public.create_invite(:'pid', 'D@test.nl ', 'lezer') \gset
select token as tok_e from public.create_invite(:'pid', 'e@test.nl', 'bewerker') \gset

select test.ok(length(:'tok_b') = 64, 'token heeft 64 tekens');
select test.ok(not exists (
  select 1 from public.project_invites where token_hash = :'tok_b'),
  'token zelf wordt niet opgeslagen, alleen de hash');
select test.faalt($$select public.create_invite('$$ || :'pid' || $$', 'geen-email', 'lezer')$$,
  'ongeldig e-mailadres geweigerd');

-- C heeft geen toegang en kan niets met het project.
select test.als(:'C');
select public.create_project('Project van C') as pid_c \gset
select test.faalt($$select public.create_invite('$$ || :'pid' || $$', 'x@test.nl', 'eigenaar')$$,
  'C (geen lid) kan niet uitnodigen');
select test.faalt($$select public.accept_invite('$$ || :'tok_b' || $$')$$,
  'C kan uitnodiging voor b@test.nl niet gebruiken');
select test.ok((select status from public.get_invite(:'tok_b')) = 'geldig',
  'uitnodiging blijft geldig na mislukte poging');

-- E heeft het e-mailadres nog niet bevestigd.
select test.als(:'E');
select test.faalt($$select public.accept_invite('$$ || :'tok_e' || $$')$$,
  'onbevestigd e-mailadres kan uitnodiging niet accepteren');

-- Niet ingelogd: uitnodiging bekijken mag, de rest niet.
select test.anoniem();
select test.ok((select project_name from public.get_invite(:'tok_b')) = 'Kavel 14',
  'niet ingelogd: uitnodiging tonen werkt');
select test.ok(not exists (select 1 from public.get_invite('verkeerd-token')),
  'niet ingelogd: onbekend token geeft niets terug');
select test.faalt($$select public.accept_invite('$$ || :'tok_b' || $$')$$,
  'niet ingelogd: accepteren geweigerd');
select test.faalt($$select public.create_project('x')$$,
  'niet ingelogd: project aanmaken geweigerd');

-- B en D accepteren.
select test.als(:'B');
select test.ok(public.accept_invite(:'tok_b') = :'pid'::uuid, 'B accepteert uitnodiging');
select test.faalt($$select public.accept_invite('$$ || :'tok_b' || $$')$$,
  'uitnodiging werkt maar één keer');
select test.als(:'D');
select test.ok(public.accept_invite(:'tok_d') = :'pid'::uuid, 'D accepteert uitnodiging als lezer');

-- Verlopen uitnodiging.
reset role;
select test.als(:'A');
select token as tok_x from public.create_invite(:'pid', 'c@test.nl', 'lezer') \gset
reset role;
update public.project_invites set expires_at = now() - interval '1 minute'
where token_hash = encode(sha256(convert_to(:'tok_x', 'UTF8')), 'hex');
select test.als(:'C');
select test.faalt($$select public.accept_invite('$$ || :'tok_x' || $$')$$,
  'verlopen uitnodiging geweigerd');

-- =============================================================================
-- 2. Gegevens vullen als eigenaar A
-- =============================================================================
select test.als(:'A');

insert into public.categories (project_id, name) values (:'pid', 'Afbouw')
returning id as cat_afbouw \gset
insert into public.categories (project_id, parent_id, name)
values (:'pid', :'cat_afbouw', 'Keuken') returning id as cat_keuken \gset
insert into public.rooms (project_id, name) values (:'pid', 'Keuken') returning id as room_keuken \gset
insert into public.rooms (project_id, name) values (:'pid', 'Woonkamer') returning id as room_woon \gset
insert into public.suppliers (project_id, name, iban, kvk_number)
values (:'pid', 'Keukenstudio', 'NL91ABNA0417164300', '12345678') returning id as sup \gset

insert into public.budget_lines (project_id, category_id, description,
  amount_excl_cents, vat_rate_bp, vat_cents, amount_incl_cents)
values (:'pid', :'cat_keuken', 'Keuken', 1983471, 2100, 416529, 2400000);

insert into public.contracts (project_id, supplier_id, title)
values (:'pid', :'sup', 'Keuken') returning id as con \gset
insert into public.contract_lines (project_id, contract_id, category_id,
  amount_excl_cents, vat_cents, amount_incl_cents)
values (:'pid', :'con', :'cat_keuken', 1239670, 260330, 1500000) returning id as conline \gset

-- Termijnfactuur, gekoppeld aan de contractregel: categorie volgt automatisch.
begin;
insert into public.cost_documents (project_id, type, supplier_id, contract_id,
  document_number, document_date, stated_total_incl_cents)
values (:'pid', 'termijnfactuur', :'sup', :'con', 'F-001', '2026-11-01', 500000)
returning id as doc \gset
insert into public.cost_lines (project_id, cost_document_id, contract_line_id,
  amount_excl_cents, vat_cents, amount_incl_cents)
values (:'pid', :'doc', :'conline', 413223, 86777, 500000) returning id as line \gset
insert into public.room_allocations (project_id, room_id, cost_line_id, share_bp)
values (:'pid', :'room_keuken', :'line', 7000), (:'pid', :'room_woon', :'line', 3000);
commit;

select test.ok((select category_id from public.cost_lines where id = :'line') = :'cat_keuken'::uuid
           and (select contract_id from public.cost_lines where id = :'line') = :'con'::uuid,
  'kostenregel krijgt contract en categorie van de contractregel');

-- Boeken (bevestigd door A) en betalen.
update public.cost_documents
set status = 'geboekt', reviewed_by = :'A', reviewed_at = now(), booked_at = now()
where id = :'doc';

-- Financiering: hypotheek 400k = bouwdepot 100k + overige 300k; eigen geld 95k.
begin;
insert into public.funding_sources (project_id, type, name, amount_cents)
values (:'pid', 'hypotheek', 'Hypotheek', 40000000) returning id as hyp \gset
insert into public.funding_sources (project_id, parent_source_id, type, name, amount_cents)
values (:'pid', :'hyp', 'bouwdepot', 'Bouwdepot', 10000000) returning id as depot \gset
insert into public.funding_sources (project_id, parent_source_id, type, name, amount_cents)
values (:'pid', :'hyp', 'overige_hypotheekruimte', 'Overige ruimte', 30000000);
insert into public.funding_sources (project_id, type, name, amount_cents)
values (:'pid', 'eigen_geld', 'Eigen geld', 9500000) returning id as eigen \gset
commit;

select test.ok((select sum(amount_cents) from public.funding_sources
                where project_id = :'pid' and parent_source_id is null) = 49500000,
  'totale financiering telt bouwdepot niet dubbel (495.000)');

insert into public.payments (project_id, cost_document_id, funding_source_id,
  amount_cents, paid_on)
values (:'pid', :'doc', :'depot', 300000, '2026-11-10');

-- Bestand en opslag.
insert into public.files (project_id, storage_path, original_name, mime_type,
  size_bytes, sha256)
values (:'pid', :'pid' || '/factuur-f001.pdf', 'factuur.pdf', 'application/pdf',
  12345, repeat('a', 64)) returning id as file \gset
insert into storage.objects (bucket_id, name, owner)
values ('documenten', :'pid' || '/factuur-f001.pdf', :'A');

insert into public.document_extractions (project_id, file_id, status)
values (:'pid', :'file', 'te_controleren');

insert into public.activity_log (project_id, action) values (:'pid', 'test');

-- =============================================================================
-- 3. Zichtbaarheid: A en B zien hetzelfde, C niets, D (lezer) hetzelfde
-- =============================================================================
select test.als(:'A');
select test.snapshot() as snap_a \gset
select test.als(:'B');
select test.snapshot() as snap_b \gset
select test.als(:'D');
select test.snapshot() as snap_d \gset

-- Uitnodigingen zijn alleen voor de eigenaar zichtbaar; die tabel vergelijken
-- we apart.
select test.ok(
  (:'snap_a'::jsonb - 'project_invites') = (:'snap_b'::jsonb - 'project_invites'),
  'A en B zien exact dezelfde gegevens in alle tabellen');
select test.ok(
  (:'snap_a'::jsonb - 'project_invites') = (:'snap_d'::jsonb - 'project_invites'),
  'D (lezer) ziet exact dezelfde gegevens als A');

select test.ok((select bool_and((v ->> 'n')::int > 0) from jsonb_each(:'snap_a'::jsonb) e(k, v)
                where k in ('categories','rooms','suppliers','budget_lines','contracts',
                            'contract_lines','cost_documents','cost_lines','room_allocations',
                            'payments','funding_sources','files','document_extractions',
                            'activity_log','project_members','projects','profiles')),
  'A ziet gegevens in alle gevulde tabellen');

select test.als(:'B');
select test.ok((select count(*) from public.project_invites) = 0,
  'B (bewerker) ziet geen uitnodigingen');

-- C ziet van project A helemaal niets.
select test.als(:'C');
select test.snapshot() as snap_c \gset
select test.ok((select count(*) from public.projects where id = :'pid') = 0,
  'C ziet het project niet');
select test.ok((
  select count(*) from public.projects p where p.id <> :'pid_c') = 0
  and (select count(*) from public.project_members where project_id = :'pid') = 0
  and (select count(*) from public.categories) = 0
  and (select count(*) from public.cost_documents) = 0
  and (select count(*) from public.payments) = 0
  and (select count(*) from public.funding_sources) = 0
  and (select count(*) from public.files) = 0
  and (select count(*) from public.project_invites) = 0
  and (select count(*) from public.activity_log where project_id = :'pid') = 0,
  'C ziet geen enkele rij van project A');
select test.ok(
  (select count(*) from public.profiles) = 1
  and (select id from public.profiles) = :'C'::uuid,
  'C ziet alleen het eigen profiel');
-- Alles wat C ziet hoort bij het eigen project van C.
select test.ok(
  test.zichtbaar_buiten_eigen_profiel(:'snap_c'::jsonb)
    = (select count(*) from public.projects)
      + (select count(*) from public.project_members)
      + (select count(*) from public.activity_log),
  'C ziet in alle tabellen samen alleen het eigen project, lidmaatschap en log');

-- =============================================================================
-- 4. Schrijfrechten
-- =============================================================================
-- C (geen lid)
select test.als(:'C');
select test.faalt($$insert into public.categories (project_id, name)
  values ('$$ || :'pid' || $$', 'Inbraak')$$, 'C kan geen categorie toevoegen aan project A');
select test.ok(test.rijen($$update public.categories set name = 'gehackt'
  where project_id = '$$ || :'pid' || $$'$$) = 0, 'C kan categorieën van A niet wijzigen');
select test.ok(test.rijen($$delete from public.cost_documents$$) = 0,
  'C kan documenten van A niet verwijderen');
select test.ok(test.rijen($$delete from public.projects where id = '$$ || :'pid' || $$'$$) = 0,
  'C kan project A niet verwijderen');
select test.faalt($$insert into public.project_members (project_id, user_id, role)
  values ('$$ || :'pid' || $$', '$$ || :'C' || $$', 'eigenaar')$$,
  'C kan zichzelf niet als lid toevoegen');
select test.ok(test.rijen($$update public.profiles set full_name = 'x'
  where id = '$$ || :'A' || $$'$$) = 0, 'C kan profiel van A niet wijzigen');

-- Koppelen aan gegevens van een ander project kan niet (samengestelde sleutels).
insert into public.categories (project_id, name) values (:'pid_c', 'Eigen') returning id as cat_c \gset
select test.faalt($$insert into public.cost_documents (project_id, type, supplier_id, document_date)
  values ('$$ || :'pid_c' || $$', 'factuur', '$$ || :'sup' || $$', '2026-11-01')$$,
  'C kan in eigen project niet naar leverancier van project A verwijzen');
select test.faalt($$insert into public.budget_lines (project_id, category_id,
  amount_excl_cents, vat_cents, amount_incl_cents)
  values ('$$ || :'pid_c' || $$', '$$ || :'cat_keuken' || $$', 100, 21, 121)$$,
  'C kan niet naar categorie van project A verwijzen');

-- D (lezer)
select test.als(:'D');
select test.faalt($$insert into public.rooms (project_id, name)
  values ('$$ || :'pid' || $$', 'Zolder')$$, 'lezer D kan niets toevoegen');
select test.ok(test.rijen($$update public.rooms set name = 'x'$$) = 0,
  'lezer D kan niets wijzigen');
select test.ok(test.rijen($$delete from public.rooms$$) = 0,
  'lezer D kan niets verwijderen');

-- B (bewerker)
select test.als(:'B');
select test.ok(test.rijen($$insert into public.rooms (project_id, name)
  values ('$$ || :'pid' || $$', 'Zolder')$$) = 1, 'bewerker B kan toevoegen');
select test.faalt($$select public.create_invite('$$ || :'pid' || $$', 'x@test.nl', 'lezer')$$,
  'bewerker B kan niet uitnodigen');
select test.ok(test.rijen($$update public.project_members set role = 'eigenaar'
  where user_id = '$$ || :'B' || $$'$$) = 0, 'bewerker B kan eigen rol niet verhogen');
select test.ok(test.rijen($$delete from public.projects$$) = 0,
  'bewerker B kan project niet verwijderen');
select test.ok(test.rijen($$update public.projects set name = 'x'$$) = 0
  and (select name from public.projects where id = :'pid') = 'Kavel 14',
  'bewerker B kan projectgegevens niet wijzigen');
select test.ok(test.rijen($$update public.profiles set full_name = 'Bram B.'
  where id = '$$ || :'B' || $$'$$) = 1, 'B kan eigen naam wijzigen');
select test.faalt($$update public.profiles set email = 'x@test.nl'
  where id = '$$ || :'B' || $$'$$, 'e-mailadres in profiel niet zelf te wijzigen');
select test.faalt($$update public.activity_log set action = 'x'$$,
  'activiteitenlog kan niet worden gewijzigd');

-- A (eigenaar)
select test.als(:'A');
select test.faalt($$delete from public.project_members
  where user_id = '$$ || :'A' || $$'$$, 'enige eigenaar kan zichzelf niet verwijderen');
select test.ok(test.rijen($$update public.project_members set role = 'lezer'
  where user_id = '$$ || :'D' || $$'$$) = 1, 'eigenaar kan rol wijzigen');

-- =============================================================================
-- 5. Opslag (privé bucket)
-- =============================================================================
select test.als(:'B');
select test.ok((select count(*) from storage.objects where bucket_id = 'documenten') = 1,
  'B ziet het bestand van het project');
select test.als(:'C');
select test.ok((select count(*) from storage.objects) = 0, 'C ziet geen bestanden van project A');
select test.faalt($$insert into storage.objects (bucket_id, name)
  values ('documenten', '$$ || :'pid' || $$/stiekem.pdf')$$,
  'C kan niet uploaden in de map van project A');
select test.faalt($$insert into storage.objects (bucket_id, name)
  values ('documenten', 'zonder-project/x.pdf')$$,
  'uploaden buiten een projectmap wordt geweigerd');
select test.ok(test.rijen($$insert into storage.objects (bucket_id, name)
  values ('documenten', '$$ || :'pid_c' || $$/eigen.pdf')$$) = 1,
  'C kan wel in de eigen projectmap uploaden');
select test.als(:'D');
select test.faalt($$insert into storage.objects (bucket_id, name)
  values ('documenten', '$$ || :'pid' || $$/lezer.pdf')$$, 'lezer D kan niet uploaden');
select test.ok(test.rijen($$delete from storage.objects$$) = 0, 'lezer D kan niets verwijderen');
reset role;
select test.ok((select public from storage.buckets where id = 'documenten') = false,
  'bucket documenten is privé');

-- =============================================================================
-- 6. Niet ingelogd (anon)
-- =============================================================================
select test.anoniem();
select test.faalt('select count(*) from public.projects', 'anon kan projecten niet lezen');
select test.faalt('select count(*) from public.cost_documents', 'anon kan documenten niet lezen');
select test.faalt('select count(*) from public.profiles', 'anon kan profielen niet lezen');
select test.ok((select count(*) from storage.objects) = 0, 'anon ziet geen bestanden');
reset role;

-- =============================================================================
-- 7. Financiële controles
-- =============================================================================
select test.als(:'A');

select test.faalt($$insert into public.budget_lines (project_id, category_id,
  amount_excl_cents, vat_cents, amount_incl_cents)
  values ('$$ || :'pid' || $$', '$$ || :'cat_afbouw' || $$', 100, 21, 121)$$,
  'bedrag op hoofdcategorie geweigerd');
select test.faalt($$insert into public.budget_lines (project_id, category_id,
  amount_excl_cents, vat_cents, amount_incl_cents)
  values ('$$ || :'pid' || $$', '$$ || :'cat_keuken' || $$', 100, 21, 122)$$,
  'incl ≠ excl + btw geweigerd');
select test.faalt($$insert into public.categories (project_id, parent_id, name)
  values ('$$ || :'pid' || $$', '$$ || :'cat_keuken' || $$', 'Sub')$$,
  'categorie met bedragen kan geen subcategorie krijgen');
select test.faalt($$update public.categories set parent_id = '$$ || :'cat_keuken' || $$'
  where id = '$$ || :'cat_afbouw' || $$'$$, 'kring in categorieboom geweigerd');

select test.faalt($$update public.room_allocations set share_bp = 5000
  where room_id = '$$ || :'room_keuken' || $$'$$, 'ruimteverdeling ≠ 100% geweigerd');

select test.faalt($$insert into public.payments (project_id, cost_document_id, amount_cents, paid_on)
  values ('$$ || :'pid' || $$', '$$ || :'doc' || $$', 200001, '2026-11-11')$$,
  'meer betalen dan het documenttotaal geweigerd');
select test.ok(test.rijen($$insert into public.payments (project_id, cost_document_id, amount_cents, paid_on)
  values ('$$ || :'pid' || $$', '$$ || :'doc' || $$', 200000, '2026-11-11')$$) = 1,
  'restant betalen tot precies het totaal mag');

-- Concept: betalen niet toegestaan; boeken alleen als totalen kloppen.
begin;
insert into public.cost_documents (project_id, type, document_date, stated_total_incl_cents)
values (:'pid', 'bon', '2026-11-20', 12100) returning id as bon \gset
insert into public.cost_lines (project_id, cost_document_id, category_id,
  amount_excl_cents, vat_cents, amount_incl_cents)
values (:'pid', :'bon', :'cat_keuken', 5000, 1050, 6050),
       (:'pid', :'bon', :'cat_keuken', 4999, 1050, 6049);
commit;
select test.faalt($$insert into public.payments (project_id, cost_document_id, amount_cents, paid_on)
  values ('$$ || :'pid' || $$', '$$ || :'bon' || $$', 100, '2026-11-20')$$,
  'betalen op een niet-geboekt document geweigerd');
select test.faalt($$update public.cost_documents set status = 'geboekt',
  reviewed_by = '$$ || :'A' || $$', reviewed_at = now(), booked_at = now()
  where id = '$$ || :'bon' || $$'$$, 'boeken geweigerd als regels ≠ totaal op bon (1 cent verschil)');
select test.faalt($$update public.cost_documents set status = 'geboekt'
  where id = '$$ || :'bon' || $$'$$, 'boeken zonder bevestiging door gebruiker geweigerd');

-- Financiering
select test.faalt($$update public.funding_sources set amount_cents = 9000000
  where id = '$$ || :'depot' || $$'$$, 'delen ≠ hypotheekbedrag geweigerd');
select test.faalt($$insert into public.funding_sources (project_id, parent_source_id, type, name, amount_cents)
  values ('$$ || :'pid' || $$', '$$ || :'eigen' || $$', 'bouwdepot', 'x', 0)$$,
  'bouwdepot onder eigen geld geweigerd');
select test.faalt($$insert into public.funding_sources (project_id, type, name, amount_cents)
  values ('$$ || :'pid' || $$', 'bouwdepot', 'los depot', 100)$$,
  'bouwdepot zonder hypotheek geweigerd');
select test.faalt($$update public.payments set funding_source_id = '$$ || :'hyp' || $$'$$,
  'betalen uit hypotheek-met-delen geweigerd (kies het deel)');

-- Bestandspad moet in de eigen projectmap staan; zelfde bestand niet dubbel.
select test.faalt($$insert into public.files (project_id, storage_path, original_name,
  mime_type, size_bytes, sha256) values ('$$ || :'pid' || $$', 'elders/x.pdf', 'x.pdf',
  'application/pdf', 1, repeat('b', 64))$$, 'bestandspad buiten projectmap geweigerd');
select test.faalt($$insert into public.files (project_id, storage_path, original_name,
  mime_type, size_bytes, sha256) values ('$$ || :'pid' || $$', '$$ || :'pid' || $$/kopie.pdf',
  'kopie.pdf', 'application/pdf', 1, repeat('a', 64))$$, 'exact duplicaat bestand geweigerd');
select test.faalt($$insert into public.cost_documents (project_id, type, supplier_id,
  document_number, document_date) values ('$$ || :'pid' || $$', 'factuur', '$$ || :'sup' || $$',
  'F-001', '2026-11-02')$$, 'dubbel factuurnummer bij dezelfde leverancier geweigerd');

-- =============================================================================
-- 8. Opruimen: een eigenaar kan het eigen project verwijderen
-- =============================================================================
select test.als(:'C');
delete from storage.objects where name like :'pid_c' || '/%';
select test.ok(test.rijen($$delete from public.categories where project_id = '$$ || :'pid_c' || $$'$$) = 1
  and test.rijen($$delete from public.projects where id = '$$ || :'pid_c' || $$'$$) = 1,
  'eigenaar C kan eigen project verwijderen (ook als laatste eigenaar)');
reset role;

-- Eigenaar A verwijdert het volledige project met alle gegevens.
select test.als(:'B');
select test.ok(test.rijen($$delete from public.projects where id = '$$ || :'pid' || $$'$$) = 0,
  'bewerker B kan het volledige project niet verwijderen');
select test.als(:'A');
select test.ok(test.rijen($$delete from public.projects where id = '$$ || :'pid' || $$'$$) = 1,
  'eigenaar A kan het volledige project met alle gegevens verwijderen');
reset role;
select test.ok(
  (select count(*) from public.cost_lines) = 0
  and (select count(*) from public.payments) = 0
  and (select count(*) from public.funding_sources) = 0
  and (select count(*) from public.project_members) = 0
  and (select count(*) from public.categories) = 0,
  'na verwijderen blijven geen gegevens achter');

\warn 'Alle beveiligingstests geslaagd.'
