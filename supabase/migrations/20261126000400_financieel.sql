-- =============================================================================
-- 0004 · Financieel: budget, offertes, contracten, documenten, betalingen
-- =============================================================================
-- Elk bedrag hoort bij precies één laag (zie docs/ARCHITECTUUR.md § 3.1):
--   plan (budget_lines) · aanbod (quotes, telt nooit mee) · toezegging
--   (contracts) · werkelijk (cost_documents/cost_lines) · betaald (payments).
--
-- Bedragkolommen op regelniveau:
--   amount_excl_cents, vat_rate_bp (0/900/2100), vat_reverse_charge,
--   vat_cents, amount_incl_cents — met incl = excl + btw.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Budget
-- -----------------------------------------------------------------------------
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category_id uuid not null,
  description text not null default '' check (char_length(description) <= 200),
  amount_excl_cents bigint not null,
  vat_rate_bp smallint not null default 2100 check (vat_rate_bp in (0, 900, 2100)),
  vat_reverse_charge boolean not null default false,
  vat_cents bigint not null,
  amount_incl_cents bigint not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, category_id)
    references public.categories (project_id, id),
  check (amount_incl_cents = amount_excl_cents + vat_cents),
  check (not vat_reverse_charge or vat_cents = 0)
);

-- -----------------------------------------------------------------------------
-- Offertes (informatief — tellen nooit mee in de berekeningen)
-- -----------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  supplier_id uuid,
  file_id uuid,
  quote_number text check (char_length(quote_number) <= 60),
  title text not null default '' check (char_length(title) <= 200),
  quote_date date,
  valid_until date,
  status public.quote_status not null default 'ontvangen',
  stated_total_incl_cents bigint,
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, supplier_id)
    references public.suppliers (project_id, id) on delete set null (supplier_id),
  foreign key (project_id, file_id)
    references public.files (project_id, id) on delete set null (file_id)
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  quote_id uuid not null,
  category_id uuid,
  description text not null default '' check (char_length(description) <= 300),
  sort_order integer not null default 0,
  amount_excl_cents bigint not null,
  vat_rate_bp smallint not null default 2100 check (vat_rate_bp in (0, 900, 2100)),
  vat_reverse_charge boolean not null default false,
  vat_cents bigint not null,
  amount_incl_cents bigint not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, quote_id)
    references public.quotes (project_id, id) on delete cascade,
  foreign key (project_id, category_id)
    references public.categories (project_id, id) on delete set null (category_id),
  check (amount_incl_cents = amount_excl_cents + vat_cents),
  check (not vat_reverse_charge or vat_cents = 0)
);

-- -----------------------------------------------------------------------------
-- Contracten (opdrachten) — de toezeggingslaag
-- -----------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  supplier_id uuid,
  quote_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 200),
  signed_on date,
  status public.contract_status not null default 'actief',
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, supplier_id)
    references public.suppliers (project_id, id) on delete set null (supplier_id),
  foreign key (project_id, quote_id)
    references public.quotes (project_id, id) on delete set null (quote_id)
);

-- Eén offerte wordt hooguit één contract.
create unique index contracts_quote_unique
  on public.contracts (quote_id) where quote_id is not null;

create table public.contract_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contract_id uuid not null,
  category_id uuid not null,
  description text not null default '' check (char_length(description) <= 300),
  sort_order integer not null default 0,
  amount_excl_cents bigint not null,
  vat_rate_bp smallint not null default 2100 check (vat_rate_bp in (0, 900, 2100)),
  vat_reverse_charge boolean not null default false,
  vat_cents bigint not null,
  amount_incl_cents bigint not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, contract_id)
    references public.contracts (project_id, id) on delete cascade,
  foreign key (project_id, category_id)
    references public.categories (project_id, id),
  check (amount_incl_cents = amount_excl_cents + vat_cents),
  check (not vat_reverse_charge or vat_cents = 0)
);

-- Meer- (+) en minderwerk (−) per contractregel.
create table public.contract_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contract_line_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 300),
  status public.change_status not null default 'voorgesteld',
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  amount_excl_cents bigint not null,
  vat_rate_bp smallint not null default 2100 check (vat_rate_bp in (0, 900, 2100)),
  vat_reverse_charge boolean not null default false,
  vat_cents bigint not null,
  amount_incl_cents bigint not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, contract_line_id)
    references public.contract_lines (project_id, id) on delete cascade,
  check (amount_incl_cents = amount_excl_cents + vat_cents),
  check (not vat_reverse_charge or vat_cents = 0),
  check ((status = 'voorgesteld') = (decided_at is null))
);

-- Termijnschema van een contract.
create table public.contract_installments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contract_id uuid not null,
  sequence integer not null check (sequence > 0),
  description text not null check (char_length(trim(description)) between 1 and 200),
  percentage_bp integer check (percentage_bp between 1 and 10000),
  amount_incl_cents bigint,
  expected_date date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (contract_id, sequence),
  foreign key (project_id, contract_id)
    references public.contracts (project_id, id) on delete cascade,
  check ((percentage_bp is null) <> (amount_incl_cents is null))
);

-- -----------------------------------------------------------------------------
-- Kostendocumenten (facturen, termijnfacturen, eindfacturen, creditnota's,
-- bonnen) en hun kostenregels — de werkelijke laag
-- -----------------------------------------------------------------------------
create table public.cost_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type public.cost_document_type not null,
  supplier_id uuid,
  file_id uuid,
  contract_id uuid,
  installment_id uuid,
  document_number text check (char_length(document_number) <= 60),
  document_date date not null,
  due_date date,
  -- Het totaal zoals het op het papier staat (controle tegen de som van de regels).
  stated_total_incl_cents bigint,
  status public.cost_document_status not null default 'concept',
  source public.document_source not null default 'handmatig',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  booked_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, supplier_id)
    references public.suppliers (project_id, id) on delete set null (supplier_id),
  foreign key (project_id, file_id)
    references public.files (project_id, id) on delete set null (file_id),
  foreign key (project_id, contract_id)
    references public.contracts (project_id, id) on delete set null (contract_id),
  foreign key (project_id, installment_id)
    references public.contract_installments (project_id, id)
    on delete set null (installment_id),
  -- Een geboekt document is altijd door een gebruiker bevestigd.
  check (status <> 'geboekt' or (reviewed_by is not null and reviewed_at is not null
                                 and booked_at is not null)),
  check (installment_id is null or contract_id is not null)
);

create index cost_documents_project_status_idx
  on public.cost_documents (project_id, status);

-- Geen dubbele factuurnummers per leverancier.
create unique index cost_documents_number_unique
  on public.cost_documents (project_id, supplier_id, document_number)
  where document_number is not null
    and supplier_id is not null
    and type <> 'bon'
    and status <> 'vervallen';

create table public.cost_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_document_id uuid not null,
  category_id uuid,
  contract_id uuid,
  contract_line_id uuid,
  description text not null default '' check (char_length(description) <= 300),
  sort_order integer not null default 0,
  amount_excl_cents bigint not null,
  vat_rate_bp smallint not null default 2100 check (vat_rate_bp in (0, 900, 2100)),
  vat_reverse_charge boolean not null default false,
  vat_cents bigint not null,
  amount_incl_cents bigint not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, cost_document_id)
    references public.cost_documents (project_id, id) on delete cascade,
  foreign key (project_id, category_id)
    references public.categories (project_id, id),
  foreign key (project_id, contract_id)
    references public.contracts (project_id, id),
  foreign key (project_id, contract_line_id)
    references public.contract_lines (project_id, id),
  check (amount_incl_cents = amount_excl_cents + vat_cents),
  check (not vat_reverse_charge or vat_cents = 0),
  -- Los (met categorie), aan een contract (naar rato) of aan een contractregel.
  check (category_id is not null or contract_id is not null),
  check (contract_line_id is null or contract_id is not null)
);

create index cost_lines_document_idx on public.cost_lines (cost_document_id);
create index cost_lines_contract_idx on public.cost_lines (contract_id);

-- Ruimteverdeling van een kosten- of contractregel (samen precies 100%).
create table public.room_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  room_id uuid not null,
  cost_line_id uuid,
  contract_line_id uuid,
  share_bp integer not null check (share_bp between 1 and 10000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, room_id)
    references public.rooms (project_id, id) on delete cascade,
  foreign key (project_id, cost_line_id)
    references public.cost_lines (project_id, id) on delete cascade,
  foreign key (project_id, contract_line_id)
    references public.contract_lines (project_id, id) on delete cascade,
  check ((cost_line_id is null) <> (contract_line_id is null))
);

create unique index room_allocations_cost_line_unique
  on public.room_allocations (cost_line_id, room_id) where cost_line_id is not null;
create unique index room_allocations_contract_line_unique
  on public.room_allocations (contract_line_id, room_id)
  where contract_line_id is not null;

-- Betalingen (deelbetalingen toegestaan). funding_source_id en depot_claim_id
-- krijgen hun foreign key in 0005, als die tabellen bestaan.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_document_id uuid not null,
  funding_source_id uuid,
  depot_claim_id uuid,
  amount_cents bigint not null check (amount_cents <> 0),
  paid_on date not null,
  description text check (char_length(description) <= 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, cost_document_id)
    references public.cost_documents (project_id, id)
);

create index payments_document_idx on public.payments (cost_document_id);

select private.apply_project_rls('public.budget_lines');
select private.apply_project_rls('public.quotes');
select private.apply_project_rls('public.quote_lines');
select private.apply_project_rls('public.contracts');
select private.apply_project_rls('public.contract_lines');
select private.apply_project_rls('public.contract_changes');
select private.apply_project_rls('public.contract_installments');
select private.apply_project_rls('public.cost_documents');
select private.apply_project_rls('public.cost_lines');
select private.apply_project_rls('public.room_allocations');
select private.apply_project_rls('public.payments');
