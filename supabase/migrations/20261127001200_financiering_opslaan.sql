-- =============================================================================
-- 0012 · Financiering opslaan en declaraties bij het bouwdepot (fase 9)
-- =============================================================================
-- 1. depot_claim_lines: welke facturen (en welk bedrag) in een declaratie bij
--    het bouwdepot zitten.
-- 2. save_funding_source: een bron in één keer opslaan; bij een hypotheek ook
--    de delen (bouwdepot en overige hypotheekruimte). Bestaande delen worden
--    bijgewerkt in plaats van vervangen, zodat betalingen en declaraties eraan
--    gekoppeld blijven. "Delen = hypotheekbedrag" (0007) geldt aan het einde
--    van de transactie.
-- 3. save_depot_claim en set_depot_claim_status: declaratie met regels in één
--    keer opslaan of van status wisselen, met controles: alleen geboekte
--    facturen, nooit meer declareren dan een factuur of het bouwdepot.
-- 4. pay_out_depot_claim: de bank heeft uitbetaald. Wat bij een factuur nog
--    openstond wordt een betaling uit het bouwdepot; wat al zelf was betaald
--    (voorgeschoten) gaat over naar het bouwdepot.
--
-- Geen bestaande tabellen of gegevens worden gewijzigd. Alle functies draaien
-- met de rechten van de gebruiker (security invoker): Row Level Security
-- bepaalt dus nog steeds wat iemand mag.
-- =============================================================================

-- 1. Regels van een declaratie ------------------------------------------------
create table public.depot_claim_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  depot_claim_id uuid not null,
  cost_document_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (depot_claim_id, cost_document_id),
  foreign key (project_id, depot_claim_id)
    references public.depot_claims (project_id, id) on delete cascade,
  foreign key (project_id, cost_document_id)
    references public.cost_documents (project_id, id) on delete cascade
);

create index depot_claim_lines_document_idx
  on public.depot_claim_lines (cost_document_id);

select private.apply_project_rls('public.depot_claim_lines');

-- Zelfde rechten als de andere projecttabellen (0009).
grant select, insert, delete on public.depot_claim_lines to authenticated;
grant update (depot_claim_id, cost_document_id, amount_cents, updated_at)
  on public.depot_claim_lines to authenticated;

create trigger depot_claim_lines_created_by
  before insert on public.depot_claim_lines
  for each row execute function private.set_created_by();

-- 2. Bron opslaan -------------------------------------------------------------
-- p_source: { id?, project_id, type, name, lender?, amount_cents,
--   interest_rate_bp?, start_date?, end_date?, notes? }
-- p_parts: alleen bij een hypotheek, anders []:
--   [ { type (bouwdepot|overige_hypotheekruimte), name, amount_cents,
--       start_date?, end_date? } ]
create function public.save_funding_source(p_source jsonb, p_parts jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_source ->> 'id', '')::uuid;
  v_project uuid := nullif(p_source ->> 'project_id', '')::uuid;
  v_type public.funding_type := (p_source ->> 'type')::public.funding_type;
  v_old_type public.funding_type;
  v_part jsonb;
  v_part_type public.funding_type;
  v_part_id uuid;
  v_keep uuid[] := '{}';
begin
  if v_project is null or not private.can_edit(v_project) then
    raise exception 'Je hebt geen rechten om de financiering te wijzigen in dit project'
      using errcode = 'insufficient_privilege';
  end if;
  if v_type in ('bouwdepot', 'overige_hypotheekruimte') then
    raise exception 'Een bouwdepot of overige hypotheekruimte is een deel van een hypotheek'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_parts is null or jsonb_typeof(p_parts) <> 'array' then
    raise exception 'De delen van de bron ontbreken'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_type <> 'hypotheek' and jsonb_array_length(p_parts) > 0 then
    raise exception 'Alleen een hypotheek kan in delen worden verdeeld'
      using errcode = 'invalid_parameter_value';
  end if;
  if (select count(distinct e.value ->> 'type') from jsonb_array_elements(p_parts) e)
     <> jsonb_array_length(p_parts) then
    raise exception 'Elk deel van de hypotheek komt maar één keer voor'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_id is null then
    insert into public.funding_sources (
      project_id, type, name, lender, amount_cents, interest_rate_bp,
      start_date, end_date, notes)
    values (
      v_project, v_type, p_source ->> 'name',
      nullif(p_source ->> 'lender', ''),
      (p_source ->> 'amount_cents')::bigint,
      nullif(p_source ->> 'interest_rate_bp', '')::integer,
      nullif(p_source ->> 'start_date', '')::date,
      nullif(p_source ->> 'end_date', '')::date,
      nullif(p_source ->> 'notes', ''))
    returning id into v_id;
  else
    select type into v_old_type from public.funding_sources
    where id = v_id and project_id = v_project and parent_source_id is null;
    if not found then
      raise exception 'Bron niet gevonden'
        using errcode = 'no_data_found';
    end if;
    if v_old_type <> v_type then
      raise exception 'Het soort bron kan niet worden gewijzigd'
        using errcode = 'invalid_parameter_value';
    end if;
    update public.funding_sources set
      name = p_source ->> 'name',
      lender = nullif(p_source ->> 'lender', ''),
      amount_cents = (p_source ->> 'amount_cents')::bigint,
      interest_rate_bp = nullif(p_source ->> 'interest_rate_bp', '')::integer,
      start_date = nullif(p_source ->> 'start_date', '')::date,
      end_date = nullif(p_source ->> 'end_date', '')::date,
      notes = nullif(p_source ->> 'notes', '')
    where id = v_id;
  end if;

  -- Delen per soort bijwerken of toevoegen.
  for v_part in select value from jsonb_array_elements(p_parts) loop
    v_part_type := (v_part ->> 'type')::public.funding_type;
    if v_part_type not in ('bouwdepot', 'overige_hypotheekruimte') then
      raise exception 'Een hypotheek bestaat uit een bouwdepot en overige hypotheekruimte'
        using errcode = 'invalid_parameter_value';
    end if;
    select id into v_part_id from public.funding_sources
    where parent_source_id = v_id and type = v_part_type
    order by created_at
    limit 1;
    if v_part_id is null then
      insert into public.funding_sources (
        project_id, parent_source_id, type, name, amount_cents,
        start_date, end_date)
      values (
        v_project, v_id, v_part_type, v_part ->> 'name',
        (v_part ->> 'amount_cents')::bigint,
        nullif(v_part ->> 'start_date', '')::date,
        nullif(v_part ->> 'end_date', '')::date)
      returning id into v_part_id;
    else
      update public.funding_sources set
        name = v_part ->> 'name',
        amount_cents = (v_part ->> 'amount_cents')::bigint,
        start_date = nullif(v_part ->> 'start_date', '')::date,
        end_date = nullif(v_part ->> 'end_date', '')::date
      where id = v_part_id;
    end if;
    v_keep := v_keep || v_part_id;
  end loop;

  -- Delen die niet meer meedoen: alleen weg als er niets aan gekoppeld is.
  if exists (
    select 1 from public.funding_sources d
    where d.parent_source_id = v_id and d.id <> all (v_keep)
      and (exists (select 1 from public.payments p where p.funding_source_id = d.id)
        or exists (select 1 from public.depot_claims c where c.funding_source_id = d.id))
  ) then
    raise exception 'Aan het deel dat je weghaalt zijn betalingen of declaraties gekoppeld'
      using errcode = 'foreign_key_violation';
  end if;
  delete from public.funding_sources
  where parent_source_id = v_id and id <> all (v_keep);

  return v_id;
end;
$$;

-- 3. Declaraties --------------------------------------------------------------
-- Controle van één declaratie (aangeroepen door de functies hieronder).
create function private.check_depot_claim(p_claim uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source uuid;
  v_depot bigint;
begin
  select c.funding_source_id, f.amount_cents into v_source, v_depot
  from public.depot_claims c
  join public.funding_sources f on f.id = c.funding_source_id
  where c.id = p_claim;
  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.depot_claim_lines l
    join public.cost_documents d on d.id = l.cost_document_id
    where l.depot_claim_id = p_claim
      and (d.status <> 'geboekt'
        or (select coalesce(sum(cl.amount_incl_cents), 0)
            from public.cost_lines cl where cl.cost_document_id = d.id) <= 0)
  ) then
    raise exception 'Alleen geboekte facturen en bonnen kunnen in een declaratie'
      using errcode = 'check_violation';
  end if;

  -- Per factuur nooit meer declareren dan het bedrag (afgewezen telt niet).
  if exists (
    select 1
    from public.depot_claim_lines l
    where l.depot_claim_id = p_claim
      and (select coalesce(sum(l2.amount_cents), 0)
           from public.depot_claim_lines l2
           join public.depot_claims c2 on c2.id = l2.depot_claim_id
           where l2.cost_document_id = l.cost_document_id
             and c2.status <> 'afgewezen')
        > (select coalesce(sum(cl.amount_incl_cents), 0)
           from public.cost_lines cl where cl.cost_document_id = l.cost_document_id)
  ) then
    raise exception 'Er wordt meer gedeclareerd dan het bedrag van de factuur'
      using errcode = 'check_violation';
  end if;

  -- Alle declaraties samen nooit meer dan het bouwdepot.
  if (select coalesce(sum(c.amount_cents), 0) from public.depot_claims c
      where c.funding_source_id = v_source and c.status <> 'afgewezen') > v_depot then
    raise exception 'De declaraties zijn samen hoger dan het bouwdepot'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- p_claim: { id?, project_id, funding_source_id (bouwdepot), claim_number?,
--   status (concept|ingediend), submitted_on?, notes? }
-- p_lines: [ { cost_document_id, amount_cents } ]  (minstens één)
create function public.save_depot_claim(p_claim jsonb, p_lines jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_claim ->> 'id', '')::uuid;
  v_project uuid := nullif(p_claim ->> 'project_id', '')::uuid;
  v_source uuid := nullif(p_claim ->> 'funding_source_id', '')::uuid;
  v_status public.depot_claim_status :=
    coalesce(nullif(p_claim ->> 'status', ''), 'concept')::public.depot_claim_status;
  v_submitted date;
  v_old public.depot_claim_status;
  v_total bigint;
begin
  if v_project is null or not private.can_edit(v_project) then
    raise exception 'Je hebt geen rechten om declaraties op te slaan in dit project'
      using errcode = 'insufficient_privilege';
  end if;
  if v_status not in ('concept', 'ingediend') then
    raise exception 'Een declaratie kan alleen als concept of ingediend worden opgeslagen'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'Kies minstens één factuur voor de declaratie'
      using errcode = 'invalid_parameter_value';
  end if;
  if not exists (
    select 1 from public.funding_sources
    where id = v_source and project_id = v_project and type = 'bouwdepot'
  ) then
    raise exception 'Een declaratie hoort bij een bouwdepot'
      using errcode = 'check_violation';
  end if;

  select coalesce(sum((e.value ->> 'amount_cents')::bigint), 0) into v_total
  from jsonb_array_elements(p_lines) e;
  v_submitted := case when v_status = 'ingediend'
    then coalesce(nullif(p_claim ->> 'submitted_on', '')::date, current_date) end;

  if v_id is null then
    insert into public.depot_claims (
      project_id, funding_source_id, claim_number, amount_cents, status,
      submitted_on, notes)
    values (
      v_project, v_source, nullif(p_claim ->> 'claim_number', ''), v_total,
      v_status, v_submitted, nullif(p_claim ->> 'notes', ''))
    returning id into v_id;
  else
    select status into v_old from public.depot_claims
    where id = v_id and project_id = v_project;
    if not found then
      raise exception 'Declaratie niet gevonden'
        using errcode = 'no_data_found';
    end if;
    if v_old = 'uitbetaald' then
      raise exception 'Een uitbetaalde declaratie kan niet meer worden gewijzigd'
        using errcode = 'check_violation';
    end if;
    update public.depot_claims set
      funding_source_id = v_source,
      claim_number = nullif(p_claim ->> 'claim_number', ''),
      amount_cents = v_total,
      status = v_status,
      submitted_on = v_submitted,
      notes = nullif(p_claim ->> 'notes', '')
    where id = v_id;
    delete from public.depot_claim_lines where depot_claim_id = v_id;
  end if;

  insert into public.depot_claim_lines (
    project_id, depot_claim_id, cost_document_id, amount_cents)
  select v_project, v_id, (e.value ->> 'cost_document_id')::uuid,
         (e.value ->> 'amount_cents')::bigint
  from jsonb_array_elements(p_lines) e;

  perform private.check_depot_claim(v_id);
  return v_id;
end;
$$;

-- Status wisselen: concept, ingediend of afgewezen. Uitbetaald gaat via
-- pay_out_depot_claim; een uitbetaalde declaratie ligt vast.
create function public.set_depot_claim_status(
  p_claim uuid, p_status public.depot_claim_status, p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.depot_claims;
begin
  select * into v_claim from public.depot_claims where id = p_claim;
  if not found or not private.can_edit(v_claim.project_id) then
    raise exception 'Declaratie niet gevonden'
      using errcode = 'no_data_found';
  end if;
  if p_status = 'uitbetaald' then
    raise exception 'Gebruik "uitbetaald" om een declaratie als uitbetaald vast te leggen'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_claim.status = 'uitbetaald' then
    raise exception 'Een uitbetaalde declaratie kan niet meer worden gewijzigd'
      using errcode = 'check_violation';
  end if;
  update public.depot_claims set
    status = p_status,
    submitted_on = case
      when p_status = 'ingediend' then coalesce(p_date, current_date)
      when p_status = 'concept' then null
      else submitted_on end
  where id = p_claim;
  if p_status <> 'afgewezen' then
    perform private.check_depot_claim(p_claim);
  end if;
end;
$$;

-- 4. Uitbetalen ---------------------------------------------------------------
create function public.pay_out_depot_claim(p_claim uuid, p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.depot_claims;
  v_line record;
  v_pay record;
  v_total bigint;
  v_paid bigint;
  v_new bigint;
  v_rest bigint;
begin
  select * into v_claim from public.depot_claims where id = p_claim;
  if not found or not private.can_edit(v_claim.project_id) then
    raise exception 'Declaratie niet gevonden'
      using errcode = 'no_data_found';
  end if;
  if v_claim.status = 'uitbetaald' then
    raise exception 'Deze declaratie is al uitbetaald'
      using errcode = 'check_violation';
  end if;
  if v_claim.status = 'afgewezen' then
    raise exception 'Een afgewezen declaratie kan niet worden uitbetaald'
      using errcode = 'check_violation';
  end if;
  if p_date is null then
    raise exception 'Vul de datum van de uitbetaling in'
      using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.depot_claim_lines where depot_claim_id = p_claim) then
    raise exception 'De declaratie heeft geen facturen'
      using errcode = 'check_violation';
  end if;
  perform private.check_depot_claim(p_claim);

  for v_line in
    select l.cost_document_id as doc, l.amount_cents as amount
    from public.depot_claim_lines l
    where l.depot_claim_id = p_claim
    order by l.created_at, l.id
  loop
    select coalesce(sum(amount_incl_cents), 0) into v_total
    from public.cost_lines where cost_document_id = v_line.doc;
    select coalesce(sum(amount_cents), 0) into v_paid
    from public.payments where cost_document_id = v_line.doc;

    -- a. Wat nog openstaat: betaling uit het bouwdepot.
    v_new := least(v_line.amount, greatest(v_total - v_paid, 0));
    if v_new > 0 then
      insert into public.payments (
        project_id, cost_document_id, funding_source_id, depot_claim_id,
        amount_cents, paid_on, description)
      values (
        v_claim.project_id, v_line.doc, v_claim.funding_source_id, p_claim,
        v_new, p_date,
        'Uit het bouwdepot' || coalesce(' (declaratie ' || v_claim.claim_number || ')', ''));
    end if;

    -- b. Wat al zelf was betaald (voorgeschoten): naar het bouwdepot.
    v_rest := v_line.amount - v_new;
    for v_pay in
      select id, amount_cents from public.payments
      where cost_document_id = v_line.doc
        and funding_source_id is distinct from v_claim.funding_source_id
        and amount_cents > 0
      order by paid_on desc, created_at desc
    loop
      exit when v_rest <= 0;
      if v_pay.amount_cents <= v_rest then
        update public.payments set
          funding_source_id = v_claim.funding_source_id,
          depot_claim_id = p_claim
        where id = v_pay.id;
        v_rest := v_rest - v_pay.amount_cents;
      else
        update public.payments set amount_cents = amount_cents - v_rest
        where id = v_pay.id;
        insert into public.payments (
          project_id, cost_document_id, funding_source_id, depot_claim_id,
          amount_cents, paid_on, description)
        select project_id, cost_document_id, v_claim.funding_source_id, p_claim,
               v_rest, paid_on, 'Terugbetaald uit het bouwdepot'
        from public.payments where id = v_pay.id;
        v_rest := 0;
      end if;
    end loop;
    if v_rest > 0 then
      raise exception 'Bij een factuur in de declaratie is al uit het bouwdepot betaald; verlaag het bedrag in de declaratie'
        using errcode = 'check_violation';
    end if;
  end loop;

  update public.depot_claims set status = 'uitbetaald', paid_out_on = p_date
  where id = p_claim;
end;
$$;

-- Rechten: alleen ingelogde gebruikers ----------------------------------------
revoke all on function public.save_funding_source(jsonb, jsonb) from public, anon;
revoke all on function public.save_depot_claim(jsonb, jsonb) from public, anon;
revoke all on function public.set_depot_claim_status(uuid, public.depot_claim_status, date)
  from public, anon;
revoke all on function public.pay_out_depot_claim(uuid, date) from public, anon;
revoke all on function private.check_depot_claim(uuid) from public, anon;
grant execute on function public.save_funding_source(jsonb, jsonb) to authenticated;
grant execute on function public.save_depot_claim(jsonb, jsonb) to authenticated;
grant execute on function public.set_depot_claim_status(uuid, public.depot_claim_status, date)
  to authenticated;
grant execute on function public.pay_out_depot_claim(uuid, date) to authenticated;
grant execute on function private.check_depot_claim(uuid) to authenticated;
