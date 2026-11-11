-- ============================================================================
-- 0002 · Catálogos: grupos de WhatsApp y planes de membresía
-- ============================================================================

create type public.moneda as enum ('COP', 'USD');

-- ───────────────────────── Grupos de WhatsApp ─────────────────────────
create table public.grupos_whatsapp (
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);
comment on table public.grupos_whatsapp is
  'Grupos de WhatsApp de Ser Elemental a los que se agrega a los pacientes.';

insert into public.grupos_whatsapp (nombre) values ('Pacientes'), ('Pacientes 2');

-- ───────────────────────── Planes de membresía ─────────────────────────
create table public.planes_membresia (
  id           smallint generated always as identity primary key,
  nombre       text not null unique,
  precio       numeric(10, 2) not null check (precio >= 0),
  moneda       public.moneda not null default 'USD',
  periodicidad text,
  activo       boolean not null default true
);
comment on table public.planes_membresia is
  'Planes de la membresía. Los tres iniciales salen de los precios del Excel; nombre y periodicidad los define Marcela.';

insert into public.planes_membresia (nombre, precio, moneda) values
  ('Plan 9.99 USD', 9.99, 'USD'),
  ('Plan 19.99 USD', 19.99, 'USD'),
  ('Plan 65 USD', 65, 'USD');

-- ───────────────────────── Seguridad ─────────────────────────
alter table public.grupos_whatsapp enable row level security;
alter table public.planes_membresia enable row level security;

grant select, insert, update, delete on public.grupos_whatsapp, public.planes_membresia to authenticated;
grant all on public.grupos_whatsapp, public.planes_membresia to service_role;

create policy grupos_whatsapp_staff on public.grupos_whatsapp
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));

create policy planes_membresia_staff on public.planes_membresia
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
