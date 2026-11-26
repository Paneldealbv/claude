-- =============================================================================
-- 0002 · Toegang: projecten, leden, uitnodigingen en activiteitenlog
-- =============================================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  address text check (char_length(address) <= 200),
  expected_completion date,
  created_by uuid references auth.users (id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'bewerker',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  role public.member_role not null default 'bewerker',
  -- Alleen de SHA-256-hash van het token wordt bewaard, nooit het token zelf.
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now()
);

create index project_invites_project_idx on public.project_invites (project_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  action text not null check (char_length(action) <= 80),
  table_name text,
  record_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_project_idx
  on public.activity_log (project_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Hulpfuncties voor de beveiligingsregels
-- security definer: ze lezen project_members zonder zelf door RLS te gaan,
-- zo ontstaan geen kringverwijzingen in de regels.
-- -----------------------------------------------------------------------------
create function private.has_role(p_project uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_project
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.is_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_project, '{eigenaar,bewerker,lezer}');
$$;

create function private.can_edit(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_project, '{eigenaar,bewerker}');
$$;

create function private.is_owner(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_project, '{eigenaar}');
$$;

-- Deelt de ingelogde gebruiker een project met dit account?
create function private.shares_project(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mij
    join public.project_members ander on ander.project_id = mij.project_id
    where mij.user_id = (select auth.uid())
      and ander.user_id = p_user
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.has_role(uuid, public.member_role[]),
  private.is_member(uuid),
  private.can_edit(uuid),
  private.is_owner(uuid),
  private.shares_project(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Laatste eigenaar beschermen: een project houdt altijd minstens één eigenaar.
-- (Bij het verwijderen van het hele project geldt dit niet.)
-- -----------------------------------------------------------------------------
create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'eigenaar'
     and (tg_op = 'DELETE' or new.role <> 'eigenaar')
     and exists (select 1 from public.projects p where p.id = old.project_id)
     and not exists (
       select 1 from public.project_members m
       where m.project_id = old.project_id
         and m.role = 'eigenaar'
         and m.user_id <> old.user_id
     )
  then
    raise exception 'Een project moet minstens één eigenaar houden'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger project_members_protect_last_owner
  before update or delete on public.project_members
  for each row execute function private.protect_last_owner();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.activity_log enable row level security;

-- Profielen: je eigen profiel, en dat van mensen met wie je een project deelt.
create policy "profiel lezen" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_project(id));

create policy "eigen profiel wijzigen" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Projecten: leden lezen, eigenaren wijzigen en verwijderen.
-- Aanmaken gaat uitsluitend via public.create_project().
create policy "project lezen" on public.projects
  for select to authenticated
  using (private.is_member(id));

create policy "project wijzigen" on public.projects
  for update to authenticated
  using (private.is_owner(id))
  with check (private.is_owner(id));

create policy "project verwijderen" on public.projects
  for delete to authenticated
  using (private.is_owner(id));

-- Leden: leden zien elkaar; eigenaren wijzigen rollen en verwijderen leden;
-- iedereen mag zichzelf uit een project verwijderen.
-- Toevoegen gaat uitsluitend via create_project() en accept_invite().
create policy "leden lezen" on public.project_members
  for select to authenticated
  using (private.is_member(project_id));

create policy "rol wijzigen" on public.project_members
  for update to authenticated
  using (private.is_owner(project_id))
  with check (private.is_owner(project_id));

create policy "lid verwijderen" on public.project_members
  for delete to authenticated
  using (private.is_owner(project_id) or user_id = (select auth.uid()));

-- Uitnodigingen: alleen eigenaren zien ze. Aanmaken, intrekken en
-- accepteren gaat via functies.
create policy "uitnodigingen lezen" on public.project_invites
  for select to authenticated
  using (private.is_owner(project_id));

-- Activiteitenlog: leden lezen; bewerkers schrijven namens zichzelf.
-- Nooit wijzigen of verwijderen.
create policy "activiteit lezen" on public.activity_log
  for select to authenticated
  using (private.is_member(project_id));

create policy "activiteit schrijven" on public.activity_log
  for insert to authenticated
  with check (
    private.can_edit(project_id) and user_id = (select auth.uid())
  );

-- Kolomrechten: alleen wat via de app gewijzigd mag worden.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke update on public.projects from authenticated;
grant update (name, address, expected_completion) on public.projects
  to authenticated;

revoke update on public.project_members from authenticated;
grant update (role) on public.project_members to authenticated;

revoke insert, update, delete on public.project_invites from authenticated;
revoke insert on public.projects, public.project_members from authenticated;
revoke update, delete on public.activity_log from authenticated;

-- -----------------------------------------------------------------------------
-- Functies die de app aanroept
-- -----------------------------------------------------------------------------

-- Nieuw woningproject; de aanmaker wordt eigenaar.
create function public.create_project(
  p_name text,
  p_address text default null,
  p_expected_completion date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_project uuid;
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  insert into public.projects (name, address, expected_completion, created_by)
  values (trim(p_name), nullif(trim(p_address), ''), p_expected_completion, v_user)
  returning id into v_project;

  insert into public.project_members (project_id, user_id, role)
  values (v_project, v_user, 'eigenaar');

  insert into public.activity_log (project_id, user_id, action, table_name, record_id)
  values (v_project, v_user, 'project_aangemaakt', 'projects', v_project);

  return v_project;
end;
$$;

-- Uitnodiging aanmaken. Geeft het token één keer terug; daarna is alleen
-- de hash bekend.
create function public.create_invite(
  p_project uuid,
  p_email text,
  p_role public.member_role default 'bewerker'
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(trim(p_email));
  v_token text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_user is null or not private.is_owner(p_project) then
    raise exception 'Alleen een eigenaar kan uitnodigen' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ongeldig e-mailadres' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.project_members m
    join public.profiles p on p.id = m.user_id
    where m.project_id = p_project and p.email = v_email
  ) then
    raise exception 'Deze persoon is al lid van het project'
      using errcode = '23505';
  end if;

  -- Eerdere openstaande uitnodigingen voor hetzelfde adres vervallen.
  update public.project_invites i
  set revoked_at = now()
  where i.project_id = p_project
    and i.email = v_email
    and i.accepted_at is null
    and i.revoked_at is null;

  -- 2 × 122 bits willekeur uit gen_random_uuid() → 64 hextekens.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.project_invites (project_id, email, role, token_hash, created_by)
  values (p_project, v_email, p_role,
          encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_user)
  returning id, project_invites.expires_at into v_id, v_expires;

  insert into public.activity_log (project_id, user_id, action, table_name, record_id, changes)
  values (p_project, v_user, 'lid_uitgenodigd', 'project_invites', v_id,
          jsonb_build_object('email', v_email, 'rol', p_role));

  return query select v_id, v_token, v_expires;
end;
$$;

-- Gegevens van een uitnodiging tonen op de acceptatiepagina (ook vóór inloggen).
create function public.get_invite(p_token text)
returns table (
  project_name text,
  invited_email text,
  role public.member_role,
  invited_by text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.name,
    i.email,
    i.role,
    coalesce(nullif(pr.full_name, ''), 'Een projectlid'),
    case
      when i.accepted_at is not null then 'gebruikt'
      when i.revoked_at is not null then 'ingetrokken'
      when i.expires_at < now() then 'verlopen'
      else 'geldig'
    end
  from public.project_invites i
  join public.projects p on p.id = i.project_id
  left join public.profiles pr on pr.id = i.created_by
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- Uitnodiging accepteren: alleen met het uitgenodigde, bevestigde e-mailadres.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.project_invites;
  v_email text;
  v_confirmed timestamptz;
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  select * into v_invite
  from public.project_invites i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'Uitnodiging niet gevonden' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Deze uitnodiging is al gebruikt' using errcode = '22023';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Deze uitnodiging is ingetrokken' using errcode = '22023';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Deze uitnodiging is verlopen' using errcode = '22023';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_user;

  if v_confirmed is null then
    raise exception 'Bevestig eerst je e-mailadres' using errcode = '42501';
  end if;
  if v_email is distinct from v_invite.email then
    raise exception 'Deze uitnodiging is voor een ander e-mailadres'
      using errcode = '42501';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (v_invite.project_id, v_user, v_invite.role)
  on conflict (project_id, user_id) do nothing;

  update public.project_invites
  set accepted_at = now(), accepted_by = v_user
  where id = v_invite.id;

  insert into public.activity_log (project_id, user_id, action, table_name, record_id)
  values (v_invite.project_id, v_user, 'uitnodiging_geaccepteerd',
          'project_invites', v_invite.id);

  return v_invite.project_id;
end;
$$;

-- Uitnodiging intrekken (alleen eigenaar).
create function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
begin
  select project_id into v_project
  from public.project_invites where id = p_invite;

  if v_project is null or not private.is_owner(v_project) then
    raise exception 'Alleen een eigenaar kan uitnodigingen intrekken'
      using errcode = '42501';
  end if;

  update public.project_invites
  set revoked_at = now()
  where id = p_invite and accepted_at is null and revoked_at is null;
end;
$$;

revoke all on function
  public.create_project(text, text, date),
  public.create_invite(uuid, text, public.member_role),
  public.get_invite(text),
  public.accept_invite(text),
  public.revoke_invite(uuid)
from public, anon;

grant execute on function
  public.create_project(text, text, date),
  public.create_invite(uuid, text, public.member_role),
  public.get_invite(text),
  public.accept_invite(text),
  public.revoke_invite(uuid)
to authenticated;

-- De acceptatiepagina toont de uitnodiging ook aan nog niet ingelogde bezoekers.
grant execute on function public.get_invite(text) to anon;
