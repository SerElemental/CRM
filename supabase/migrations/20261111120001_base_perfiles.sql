-- ============================================================================
-- 0001 · Perfiles del equipo y base de seguridad — CRM Ser Elemental
-- ============================================================================
-- Regla de acceso de TODO el CRM: solo entra quien tiene un perfil activo.
-- Los perfiles NO se crean solos al registrarse: los crea el script
-- `npm run seed:admin` con la service key. Así, aunque alguien logre crear una
-- cuenta en Supabase Auth, no ve ningún dato de pacientes.

create schema if not exists private;
grant usage on schema private to authenticated;

create extension if not exists unaccent with schema extensions;

-- ───────────────────────── updated_at automático ─────────────────────────
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public;

-- ───────────────────────── Perfiles ─────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Equipo con acceso al CRM (1:1 con auth.users). Sin perfil activo no hay acceso.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ¿El usuario actual es del equipo? SECURITY DEFINER para no disparar la RLS
-- de profiles desde sus propias políticas.
create or replace function private.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and activo
  );
$$;
revoke all on function private.es_staff() from public;
grant execute on function private.es_staff() to authenticated;

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.es_staff()));
