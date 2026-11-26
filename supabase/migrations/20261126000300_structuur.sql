-- =============================================================================
-- 0003 · Structuur: categorieën, ruimtes, leveranciers en bestanden
-- =============================================================================

-- Standaard RLS voor een projecttabel:
--   lezen   → alle leden van het project
--   wijzigen→ eigenaar en bewerker
-- Wordt ook in latere migraties gebruikt.
create function private.apply_project_rls(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format(
    'create policy "leden lezen" on %s for select to authenticated
       using (private.is_member(project_id))', p_table);
  execute format(
    'create policy "bewerkers toevoegen" on %s for insert to authenticated
       with check (private.can_edit(project_id))', p_table);
  execute format(
    'create policy "bewerkers wijzigen" on %s for update to authenticated
       using (private.can_edit(project_id))
       with check (private.can_edit(project_id))', p_table);
  execute format(
    'create policy "bewerkers verwijderen" on %s for delete to authenticated
       using (private.can_edit(project_id))', p_table);
  execute format(
    'create trigger %I before update on %s
       for each row execute function private.set_updated_at()',
    replace(p_table::text, 'public.', '') || '_updated_at', p_table);
end;
$$;

revoke all on function private.apply_project_rls(regclass) from public, anon, authenticated;

-- Standaardkolommen voor elke projecttabel (als commentaar ter referentie):
--   id, project_id, created_by, created_at, updated_at
--   + unique (project_id, id) als doel voor samengestelde foreign keys.

-- -----------------------------------------------------------------------------
-- Categorieën (boomstructuur). Bedragen hangen alleen aan eindcategorieën.
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, parent_id)
    references public.categories (project_id, id),
  check (parent_id is null or parent_id <> id),
  check (is_closed = (closed_at is not null))
);

create index categories_parent_idx on public.categories (project_id, parent_id);

-- Geen kringen in de boom (A onder B onder A).
create function private.check_category_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    with recursive voorouders as (
      select c.id, c.parent_id from public.categories c where c.id = new.parent_id
      union all
      select c.id, c.parent_id
      from public.categories c
      join voorouders v on c.id = v.parent_id
    )
    select 1 from voorouders where id = new.id
  ) then
    raise exception 'Een categorie kan niet onder zichzelf hangen'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categories_no_cycle
  before insert or update of parent_id on public.categories
  for each row execute function private.check_category_cycle();

-- -----------------------------------------------------------------------------
-- Ruimtes (los van de financiële categorieën)
-- -----------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  floor text check (char_length(floor) <= 40),
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id)
);

-- -----------------------------------------------------------------------------
-- Leveranciers
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  contact_person text check (char_length(contact_person) <= 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40),
  iban text check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  kvk_number text check (kvk_number ~ '^[0-9]{8}$'),
  vat_number text check (char_length(vat_number) <= 20),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id)
);

-- -----------------------------------------------------------------------------
-- Bestanden (originele documenten in Storage, elk één keer)
-- -----------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) <= 255),
  mime_type text not null check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png',
                  'image/webp', 'image/heic', 'image/heif')
  ),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  -- Exact hetzelfde bestand kan per project maar één keer bestaan.
  unique (project_id, sha256),
  -- Het bestand moet in de map van het eigen project staan.
  check (storage_path like project_id::text || '/%')
);

select private.apply_project_rls('public.categories');
select private.apply_project_rls('public.rooms');
select private.apply_project_rls('public.suppliers');
select private.apply_project_rls('public.files');
