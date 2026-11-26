-- =============================================================================
-- 0005 · Financiering: bronnen (met delen zoals het bouwdepot) en declaraties
-- =============================================================================
-- Een hypotheek is één hoofdbron. Bouwdepot en overige hypotheekruimte zijn
-- DELEN daarvan (parent_source_id gevuld) en tellen niet mee in het totaal.
-- Totaal beschikbaar = som van bronnen zonder parent_source_id.
-- =============================================================================

create table public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_source_id uuid,
  type public.funding_type not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  lender text check (char_length(lender) <= 120),
  amount_cents bigint not null check (amount_cents >= 0),
  interest_rate_bp integer check (interest_rate_bp between 0 and 10000),
  start_date date,
  end_date date,
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, parent_source_id)
    references public.funding_sources (project_id, id) on delete cascade,
  -- Delen hebben altijd een bovenliggende bron; hoofdbronnen nooit.
  check (
    (type in ('bouwdepot', 'overige_hypotheekruimte')) = (parent_source_id is not null)
  ),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- Een deel moet onder een hypotheek hangen (en niet onder een ander deel).
create function private.check_funding_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_source_id is not null and not exists (
    select 1 from public.funding_sources f
    where f.id = new.parent_source_id and f.type = 'hypotheek'
  ) then
    raise exception 'Bouwdepot en overige hypotheekruimte horen bij een hypotheek'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger funding_sources_parent_check
  before insert or update of parent_source_id, type on public.funding_sources
  for each row execute function private.check_funding_parent();

-- Declaraties bij het bouwdepot (schermen volgen later).
create table public.depot_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  funding_source_id uuid not null,
  claim_number text check (char_length(claim_number) <= 60),
  amount_cents bigint not null check (amount_cents > 0),
  status public.depot_claim_status not null default 'concept',
  submitted_on date,
  paid_out_on date,
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, funding_source_id)
    references public.funding_sources (project_id, id)
);

create function private.check_depot_claim_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.funding_sources f
    where f.id = new.funding_source_id and f.type = 'bouwdepot'
  ) then
    raise exception 'Een declaratie hoort bij een bouwdepot'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger depot_claims_source_check
  before insert or update of funding_source_id on public.depot_claims
  for each row execute function private.check_depot_claim_source();

-- Betalingen koppelen aan de bron waaruit betaald is.
alter table public.payments
  add foreign key (project_id, funding_source_id)
    references public.funding_sources (project_id, id)
    on delete set null (funding_source_id),
  add foreign key (project_id, depot_claim_id)
    references public.depot_claims (project_id, id)
    on delete set null (depot_claim_id);

-- Betalen gebeurt uit een deel of uit een hoofdbron zonder delen,
-- nooit uit een hypotheek die in delen is opgesplitst.
create function private.check_payment_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.funding_source_id is not null and exists (
    select 1 from public.funding_sources d
    where d.parent_source_id = new.funding_source_id
  ) then
    raise exception 'Kies het deel van de hypotheek waaruit betaald is (bijv. het bouwdepot)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payments_source_check
  before insert or update of funding_source_id on public.payments
  for each row execute function private.check_payment_source();

select private.apply_project_rls('public.funding_sources');
select private.apply_project_rls('public.depot_claims');
