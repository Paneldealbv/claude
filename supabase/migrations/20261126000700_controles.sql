-- =============================================================================
-- 0007 · Databasecontroles uit docs/ARCHITECTUUR.md § 4
-- =============================================================================
-- Controles die over meerdere rijen gaan (sommen) zijn "deferred": ze worden
-- pas aan het eind van een transactie gecontroleerd, zodat de app eerst alle
-- regels kan opslaan en dan pas het geheel wordt getoetst.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bedragen alleen op eindcategorieën
-- -----------------------------------------------------------------------------
create function private.check_leaf_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and exists (
    select 1 from public.categories c where c.parent_id = new.category_id
  ) then
    raise exception 'Bedragen horen bij een eindcategorie, niet bij een hoofdcategorie'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger budget_lines_leaf before insert or update of category_id
  on public.budget_lines for each row execute function private.check_leaf_category();
create trigger quote_lines_leaf before insert or update of category_id
  on public.quote_lines for each row execute function private.check_leaf_category();
create trigger contract_lines_leaf before insert or update of category_id
  on public.contract_lines for each row execute function private.check_leaf_category();

-- Een categorie met bedragen kan geen subcategorieën krijgen.
create function private.check_parent_has_no_amounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null and (
       exists (select 1 from public.budget_lines   x where x.category_id = new.parent_id)
    or exists (select 1 from public.quote_lines    x where x.category_id = new.parent_id)
    or exists (select 1 from public.contract_lines x where x.category_id = new.parent_id)
    or exists (select 1 from public.cost_lines     x where x.category_id = new.parent_id)
  ) then
    raise exception 'Deze categorie heeft al bedragen en kan geen subcategorieën krijgen'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categories_parent_no_amounts
  before insert or update of parent_id on public.categories
  for each row execute function private.check_parent_has_no_amounts();

-- -----------------------------------------------------------------------------
-- 2. Kostenregel gekoppeld aan een contractregel: contract en categorie
--    volgen automatisch uit de contractregel.
-- -----------------------------------------------------------------------------
create function private.sync_cost_line_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract uuid;
  v_category uuid;
begin
  if new.contract_line_id is not null then
    select cl.contract_id, cl.category_id into v_contract, v_category
    from public.contract_lines cl where cl.id = new.contract_line_id;
    new.contract_id := v_contract;
    new.category_id := v_category;
  end if;

  if new.category_id is not null and exists (
    select 1 from public.categories c where c.parent_id = new.category_id
  ) then
    raise exception 'Bedragen horen bij een eindcategorie, niet bij een hoofdcategorie'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger cost_lines_sync_contract
  before insert or update of contract_line_id, contract_id, category_id
  on public.cost_lines
  for each row execute function private.sync_cost_line_contract();

-- Wijzigt de categorie van een contractregel, dan volgen de kostenregels.
create function private.propagate_contract_line_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cost_lines
  set category_id = new.category_id
  where contract_line_id = new.id;
  return new;
end;
$$;

create trigger contract_lines_propagate_category
  after update of category_id on public.contract_lines
  for each row
  when (old.category_id is distinct from new.category_id)
  execute function private.propagate_contract_line_category();

-- -----------------------------------------------------------------------------
-- 3. Ruimteverdeling per regel telt op tot precies 100% (of er is geen)
-- -----------------------------------------------------------------------------
create function private.check_room_allocation_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_sum bigint;
begin
  for r in
    select x.cost_line_id, x.contract_line_id
    from (values (new.cost_line_id, new.contract_line_id),
                 (old.cost_line_id, old.contract_line_id)) as x(cost_line_id, contract_line_id)
    where x.cost_line_id is not null or x.contract_line_id is not null
  loop
    select coalesce(sum(a.share_bp), 0) into v_sum
    from public.room_allocations a
    where (r.cost_line_id is not null and a.cost_line_id = r.cost_line_id)
       or (r.contract_line_id is not null and a.contract_line_id = r.contract_line_id);

    if v_sum not in (0, 10000) then
      raise exception 'De ruimteverdeling van een regel moet samen 100 procent zijn (nu % procent)',
        round(v_sum / 100.0, 2)
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

create constraint trigger room_allocations_sum
  after insert or update or delete on public.room_allocations
  deferrable initially deferred
  for each row execute function private.check_room_allocation_sum();

-- -----------------------------------------------------------------------------
-- 4. Kostendocument: boeken alleen als het klopt; betalingen nooit meer dan
--    het documenttotaal; betalen alleen op geboekte documenten.
-- -----------------------------------------------------------------------------
create function private.check_cost_document(p_document uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.cost_documents;
  v_total bigint;
  v_lines integer;
  v_paid bigint;
begin
  select * into v_doc from public.cost_documents where id = p_document;
  if not found then
    return; -- document verwijderd
  end if;

  select coalesce(sum(amount_incl_cents), 0), count(*)
  into v_total, v_lines
  from public.cost_lines where cost_document_id = p_document;

  select coalesce(sum(amount_cents), 0) into v_paid
  from public.payments where cost_document_id = p_document;

  if v_doc.status = 'geboekt' then
    if v_lines = 0 then
      raise exception 'Een geboekt document heeft minstens één kostenregel'
        using errcode = 'check_violation';
    end if;
    if v_doc.stated_total_incl_cents is not null
       and v_doc.stated_total_incl_cents <> v_total then
      raise exception 'De som van de regels wijkt af van het totaal op het document'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_paid <> 0 then
    if v_doc.status <> 'geboekt' then
      raise exception 'Betalingen kunnen alleen bij een geboekt document'
        using errcode = 'check_violation';
    end if;
    if (v_total >= 0 and (v_paid < 0 or v_paid > v_total))
       or (v_total < 0 and (v_paid > 0 or v_paid < v_total)) then
      raise exception 'Er is meer betaald dan het totaal van het document'
        using errcode = 'check_violation';
    end if;
  end if;
end;
$$;

create function private.trg_check_cost_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'cost_documents' then
    perform private.check_cost_document(new.id);
  else
    -- Let op: "record is not null" is alleen waar als álle velden gevuld
    -- zijn, daarom op tg_op controleren.
    if tg_op in ('INSERT', 'UPDATE') then
      perform private.check_cost_document(new.cost_document_id);
    end if;
    if tg_op = 'DELETE'
       or (tg_op = 'UPDATE' and old.cost_document_id <> new.cost_document_id) then
      perform private.check_cost_document(old.cost_document_id);
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger cost_documents_controle
  after insert or update on public.cost_documents
  deferrable initially deferred
  for each row execute function private.trg_check_cost_document();

create constraint trigger cost_lines_controle_document
  after insert or update or delete on public.cost_lines
  deferrable initially deferred
  for each row execute function private.trg_check_cost_document();

create constraint trigger payments_controle_document
  after insert or update or delete on public.payments
  deferrable initially deferred
  for each row execute function private.trg_check_cost_document();

-- -----------------------------------------------------------------------------
-- 5. Delen van een hypotheek zijn samen precies het bedrag van de hypotheek
-- -----------------------------------------------------------------------------
create function private.check_funding_parts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent uuid;
  v_amount bigint;
  v_parts bigint;
  v_count integer;
begin
  foreach v_parent in array array[
    new.parent_source_id, old.parent_source_id, new.id, old.id
  ]
  loop
    continue when v_parent is null;

    select f.amount_cents into v_amount
    from public.funding_sources f where f.id = v_parent;
    continue when not found;

    select coalesce(sum(d.amount_cents), 0), count(*) into v_parts, v_count
    from public.funding_sources d where d.parent_source_id = v_parent;

    if v_count > 0 and v_parts <> v_amount then
      raise exception 'De delen van de hypotheek (bijv. bouwdepot en overige ruimte) moeten samen precies het hypotheekbedrag zijn'
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

create constraint trigger funding_sources_parts_sum
  after insert or update or delete on public.funding_sources
  deferrable initially deferred
  for each row execute function private.check_funding_parts();

-- -----------------------------------------------------------------------------
-- 6. Afsluiten van een categorie: wie en wanneer automatisch vastleggen
--    (de controlelijst vóór het afsluiten zit in de app, fase 4)
-- -----------------------------------------------------------------------------
create function private.set_category_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_closed and not old.is_closed then
    new.closed_at := now();
    new.closed_by := (select auth.uid());
  elsif not new.is_closed then
    new.closed_at := null;
    new.closed_by := null;
  end if;
  return new;
end;
$$;

create trigger categories_closed
  before update of is_closed on public.categories
  for each row execute function private.set_category_closed();
