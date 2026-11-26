-- =============================================================================
-- 0006 · Documentherkenning (alleen de tabel; de AI-functie volgt in fase 8)
-- =============================================================================
-- Een AI-voorstel wordt nooit automatisch geboekt. Het resultaat staat hier
-- tot een gebruiker het controleert; pas dan ontstaat een geboekt
-- cost_document (zie docs/ARCHITECTUUR.md § 5).
-- =============================================================================

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_id uuid not null,
  status public.extraction_status not null default 'wachtrij',
  model text check (char_length(model) <= 80),
  -- Per veld: waarde, zekerheid (0–1) en brontekst.
  result jsonb,
  -- Punten ter controle: ontbreekt / klopt niet / onzeker / duplicaat.
  issues jsonb not null default '[]'::jsonb,
  suggested_supplier_id uuid,
  suggested_contract_id uuid,
  duplicate_candidates jsonb not null default '[]'::jsonb,
  cost_document_id uuid,
  error text check (char_length(error) <= 2000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, file_id)
    references public.files (project_id, id) on delete cascade,
  foreign key (project_id, suggested_supplier_id)
    references public.suppliers (project_id, id)
    on delete set null (suggested_supplier_id),
  foreign key (project_id, suggested_contract_id)
    references public.contracts (project_id, id)
    on delete set null (suggested_contract_id),
  foreign key (project_id, cost_document_id)
    references public.cost_documents (project_id, id)
    on delete set null (cost_document_id),
  check (jsonb_typeof(issues) = 'array'),
  check (jsonb_typeof(duplicate_candidates) = 'array')
);

create index document_extractions_project_status_idx
  on public.document_extractions (project_id, status);

select private.apply_project_rls('public.document_extractions');
