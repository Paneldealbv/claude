-- =============================================================================
-- 0001 · Basis: schema's, opsommingstypes, hulpfuncties en profielen
-- =============================================================================
-- Conventies (zie docs/ARCHITECTUUR.md):
--   * bedragen in hele centen (bigint), kolomnamen eindigen op _cents
--   * BTW-tarief in basispunten (2100 = 21%)
--   * elke projecttabel heeft project_id en een samengestelde sleutel
--     (project_id, id), zodat koppelingen nooit over projectgrenzen heen gaan
--   * hulpfuncties voor beveiliging staan in het schema "private", dat niet
--     via de API bereikbaar is
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Opsommingstypes
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('eigenaar', 'bewerker', 'lezer');

create type public.quote_status as enum (
  'ontvangen', 'geaccepteerd', 'afgewezen', 'verlopen'
);

create type public.contract_status as enum ('actief', 'afgerond', 'geannuleerd');

create type public.change_status as enum ('voorgesteld', 'akkoord', 'afgewezen');

create type public.cost_document_type as enum (
  'factuur', 'termijnfactuur', 'eindfactuur', 'creditnota', 'bon'
);

create type public.cost_document_status as enum (
  'concept', 'te_controleren', 'geboekt', 'vervallen'
);

create type public.document_source as enum ('handmatig', 'ai');

create type public.funding_type as enum (
  'eigen_geld', 'hypotheek', 'schenking', 'lening', 'overig',
  -- delen van een hypotheek (hebben altijd een bovenliggende hypotheek):
  'bouwdepot', 'overige_hypotheekruimte'
);

create type public.depot_claim_status as enum (
  'concept', 'ingediend', 'uitbetaald', 'afgewezen'
);

create type public.extraction_status as enum (
  'wachtrij', 'bezig', 'te_controleren', 'verwerkt', 'mislukt', 'afgewezen'
);

-- -----------------------------------------------------------------------------
-- Algemene triggerfunctie: updated_at bijwerken
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profielen (één per account, automatisch aangemaakt bij registratie)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Openbare gegevens van een account, zichtbaar voor medeleden van een project.';

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Bij registratie: profiel aanmaken. Naam komt uit de registratiegegevens.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- E-mailadres in het profiel gelijk houden met het account.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();
