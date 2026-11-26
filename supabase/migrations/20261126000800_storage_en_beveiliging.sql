-- =============================================================================
-- 0008 · Privé opslag voor documenten en extra beveiliging
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Privé bucket. Bestanden staan op het pad "<project-id>/<…>".
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documenten',
  'documenten',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png',
        'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Project-id uit het pad; null als het eerste deel geen geldige uuid is.
create function private.project_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1)
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

revoke all on function private.project_from_path(text) from public, anon;
grant execute on function private.project_from_path(text) to authenticated;

create policy "documenten lezen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documenten'
    and private.is_member(private.project_from_path(name))
  );

create policy "documenten uploaden" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documenten'
    and private.can_edit(private.project_from_path(name))
  );

create policy "documenten wijzigen" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documenten'
    and private.can_edit(private.project_from_path(name))
  )
  with check (
    bucket_id = 'documenten'
    and private.can_edit(private.project_from_path(name))
  );

create policy "documenten verwijderen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documenten'
    and private.can_edit(private.project_from_path(name))
  );

-- -----------------------------------------------------------------------------
-- Extra beveiliging: niet-ingelogde bezoekers (anon) krijgen nergens rechten,
-- ook niet op tabellen die later worden toegevoegd.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- Hulpfuncties (triggers) zijn niet bedoeld om direct aan te roepen.
revoke all on all functions in schema private from public, anon;
grant execute on function
  private.has_role(uuid, public.member_role[]),
  private.is_member(uuid),
  private.can_edit(uuid),
  private.is_owner(uuid),
  private.shares_project(uuid),
  private.project_from_path(text)
to authenticated;

-- Alleen get_invite is zonder inloggen bruikbaar.
revoke execute on all functions in schema public from anon, public;
grant execute on function public.get_invite(text) to anon;
