-- =============================================================================
-- 0011 · Kostendocumenten in één keer opslaan (fase 6)
-- =============================================================================
-- 1. Boeken legt de database zelf vast: wie (de ingelogde gebruiker) en
--    wanneer. Terugzetten naar concept wist het boekmoment.
-- 2. save_cost_document: document + alle regels + ruimteverdeling in één
--    transactie. Lukt één onderdeel niet, dan wordt niets opgeslagen. De
--    bestaande controles (0007) gelden aan het einde van de transactie, dus
--    ook een geboekt document met betalingen kan in één keer worden
--    gecorrigeerd, zolang het daarna klopt.
-- 3. delete_cost_document: document met zijn betalingen in één keer weg.
--
-- Beide functies draaien met de rechten van de gebruiker (security invoker):
-- Row Level Security bepaalt dus nog steeds wat iemand mag.
-- =============================================================================

-- 1. Boeken: wie en wanneer ---------------------------------------------------
create function private.set_cost_document_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'geboekt'
     and (tg_op = 'INSERT' or old.status is distinct from 'geboekt') then
    -- Een ingelogde gebruiker boekt zelf; beheertaken (zonder gebruiker)
    -- moeten reviewed_by expliciet invullen (anders weigert de controle).
    new.reviewed_by := coalesce((select auth.uid()), new.reviewed_by);
    new.reviewed_at := now();
    new.booked_at := now();
  elsif new.status <> 'geboekt' then
    new.booked_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.set_cost_document_booked()
  from public, anon, authenticated;

create trigger cost_documents_booked
  before insert or update of status on public.cost_documents
  for each row execute function private.set_cost_document_booked();

-- 2. Opslaan ------------------------------------------------------------------
-- p_document: { id?, project_id, type, status (concept|te_controleren|geboekt),
--   supplier_id?, file_id?, contract_id?, installment_id?, document_number?,
--   document_date, due_date?, stated_total_incl_cents?, notes?, source? }
-- p_lines: [ { description, category_id?, contract_id?, contract_line_id?,
--   amount_excl_cents, vat_rate_bp, vat_cents, amount_incl_cents,
--   rooms?: [room_id, …] } ]   (ruimtes: bedrag gelijk verdeeld)
create function public.save_cost_document(p_document jsonb, p_lines jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_document ->> 'id', '')::uuid;
  v_project uuid := nullif(p_document ->> 'project_id', '')::uuid;
  v_status public.cost_document_status :=
    coalesce(nullif(p_document ->> 'status', ''), 'concept')::public.cost_document_status;
  v_contract uuid := nullif(p_document ->> 'contract_id', '')::uuid;
  v_installment uuid := nullif(p_document ->> 'installment_id', '')::uuid;
  v_line jsonb;
  v_ord bigint;
  v_line_id uuid;
  v_rooms jsonb;
  v_n integer;
begin
  if v_project is null or not private.can_edit(v_project) then
    raise exception 'Je hebt geen rechten om documenten op te slaan in dit project'
      using errcode = 'insufficient_privilege';
  end if;
  if v_status not in ('concept', 'te_controleren', 'geboekt') then
    raise exception 'Een document kan alleen als concept, ter controle of geboekt worden opgeslagen'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'De regels van het document ontbreken'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_installment is not null and not exists (
    select 1 from public.contract_installments t
    where t.id = v_installment
      and t.project_id = v_project
      and t.contract_id is not distinct from v_contract
  ) then
    raise exception 'De termijn hoort niet bij het gekozen contract'
      using errcode = 'check_violation';
  end if;

  if v_id is null then
    insert into public.cost_documents (
      project_id, type, status, source, supplier_id, file_id, contract_id,
      installment_id, document_number, document_date, due_date,
      stated_total_incl_cents, notes)
    values (
      v_project,
      (p_document ->> 'type')::public.cost_document_type,
      v_status,
      coalesce(nullif(p_document ->> 'source', ''), 'handmatig')::public.document_source,
      nullif(p_document ->> 'supplier_id', '')::uuid,
      nullif(p_document ->> 'file_id', '')::uuid,
      v_contract,
      v_installment,
      nullif(p_document ->> 'document_number', ''),
      (p_document ->> 'document_date')::date,
      nullif(p_document ->> 'due_date', '')::date,
      nullif(p_document ->> 'stated_total_incl_cents', '')::bigint,
      nullif(p_document ->> 'notes', ''))
    returning id into v_id;
  else
    update public.cost_documents set
      type = (p_document ->> 'type')::public.cost_document_type,
      status = v_status,
      supplier_id = nullif(p_document ->> 'supplier_id', '')::uuid,
      file_id = nullif(p_document ->> 'file_id', '')::uuid,
      contract_id = v_contract,
      installment_id = v_installment,
      document_number = nullif(p_document ->> 'document_number', ''),
      document_date = (p_document ->> 'document_date')::date,
      due_date = nullif(p_document ->> 'due_date', '')::date,
      stated_total_incl_cents = nullif(p_document ->> 'stated_total_incl_cents', '')::bigint,
      notes = nullif(p_document ->> 'notes', '')
    where id = v_id and project_id = v_project;
    if not found then
      raise exception 'Document niet gevonden'
        using errcode = 'no_data_found';
    end if;
    -- Regels opnieuw opbouwen (ruimteverdeling gaat mee weg).
    delete from public.cost_lines where cost_document_id = v_id;
  end if;

  for v_line, v_ord in
    select value, ordinality from jsonb_array_elements(p_lines) with ordinality
  loop
    insert into public.cost_lines (
      project_id, cost_document_id, category_id, contract_id,
      contract_line_id, description, sort_order, amount_excl_cents,
      vat_rate_bp, vat_cents, amount_incl_cents)
    values (
      v_project,
      v_id,
      nullif(v_line ->> 'category_id', '')::uuid,
      nullif(v_line ->> 'contract_id', '')::uuid,
      nullif(v_line ->> 'contract_line_id', '')::uuid,
      coalesce(v_line ->> 'description', ''),
      v_ord,
      (v_line ->> 'amount_excl_cents')::bigint,
      (v_line ->> 'vat_rate_bp')::smallint,
      (v_line ->> 'vat_cents')::bigint,
      (v_line ->> 'amount_incl_cents')::bigint)
    returning id into v_line_id;

    v_rooms := coalesce(v_line -> 'rooms', '[]'::jsonb);
    v_n := case when jsonb_typeof(v_rooms) = 'array'
                then jsonb_array_length(v_rooms) else 0 end;
    if v_n > 0 then
      -- Gelijk verdelen in basispunten; de eerste ruimtes krijgen de rest.
      insert into public.room_allocations (project_id, room_id, cost_line_id, share_bp)
      select v_project, (r.value #>> '{}')::uuid, v_line_id,
             10000 / v_n + case when r.ordinality <= 10000 % v_n then 1 else 0 end
      from jsonb_array_elements(v_rooms) with ordinality as r;
    end if;
  end loop;

  return v_id;
end;
$$;

-- 3. Verwijderen --------------------------------------------------------------
-- Geeft het bestand terug, zodat de app het kan opruimen als niets anders
-- er nog naar verwijst.
create function public.delete_cost_document(p_document uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
  v_file uuid;
begin
  select project_id, file_id into v_project, v_file
  from public.cost_documents where id = p_document;
  if not found or not private.can_edit(v_project) then
    raise exception 'Document niet gevonden'
      using errcode = 'no_data_found';
  end if;
  delete from public.payments where cost_document_id = p_document;
  delete from public.cost_documents where id = p_document;
  return v_file;
end;
$$;

revoke all on function public.save_cost_document(jsonb, jsonb) from public, anon;
revoke all on function public.delete_cost_document(uuid) from public, anon;
grant execute on function public.save_cost_document(jsonb, jsonb) to authenticated;
grant execute on function public.delete_cost_document(uuid) to authenticated;
