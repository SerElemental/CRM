-- ============================================================================
-- 0003 · Pacientes (ficha interna) y tarifas por año
-- ============================================================================

create type public.paciente_tipo as enum ('individual', 'pareja', 'adolescente', 'nino');
create type public.paciente_estado as enum (
  'activo', 'seguimiento', 'inactivo', 'inactivo_sin_pagar', 'remitido'
);
create type public.modalidad as enum ('online', 'presencial');
create type public.plan_trabajo as enum ('si', 'no', 'no_aplica');

create table public.pacientes (
  id                       uuid primary key default gen_random_uuid(),
  -- Identidad
  numero                   integer,
  excel_fila               integer unique,
  nombre_completo          text not null check (length(btrim(nombre_completo)) > 0),
  tipo                     public.paciente_tipo not null default 'individual',
  -- Contacto
  pais                     text,
  telefono                 text,
  email                    text,
  grupo_whatsapp_id        smallint references public.grupos_whatsapp (id) on delete set null,
  -- Proceso terapéutico
  estado                   public.paciente_estado not null default 'activo',
  modalidad                public.modalidad,
  fecha_inicio             date,
  fecha_inicio_texto       text,
  ultima_sesion            date,
  plan_trabajo_enviado     public.plan_trabajo,
  consentimiento           boolean not null default false,
  -- Membresía
  es_miembro               boolean not null default false,
  correo_membresia_enviado boolean not null default false,
  plan_membresia_id        smallint references public.planes_membresia (id) on delete set null,
  -- Seguimiento
  flyer_enviado            boolean not null default false,
  flyer_enviado_el         date,
  no_contactar             boolean not null default false,
  no_contactar_motivo      text,
  notas                    text,
  -- Texto normalizado (minúsculas, sin tildes) para el buscador
  busqueda                 text not null default '',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.pacientes is 'Ficha interna de cada paciente de Ser Elemental.';
comment on column public.pacientes.excel_fila is
  'Fila del Excel de origen. Es la clave que hace repetible la importación.';
comment on column public.pacientes.fecha_inicio_texto is
  'Texto original de la fecha de inicio cuando no se pudo convertir a fecha.';
comment on column public.pacientes.ultima_sesion is
  'Se importa del Excel y luego la mantiene el trigger de sesiones.';

create index pacientes_estado_idx on public.pacientes (estado);
create index pacientes_nombre_idx on public.pacientes (nombre_completo);

-- Número consecutivo + texto de búsqueda.
create or replace function private.pacientes_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero from public.pacientes;
  end if;
  new.busqueda := lower(extensions.unaccent(
    concat_ws(' ', new.nombre_completo, new.telefono, new.email)
  ));
  return new;
end;
$$;
revoke all on function private.pacientes_antes_de_guardar() from public;

create trigger pacientes_antes_de_guardar
  before insert or update on public.pacientes
  for each row execute function private.pacientes_antes_de_guardar();

create trigger pacientes_set_updated_at
  before update on public.pacientes
  for each row execute function private.set_updated_at();

-- ───────────────────────── Tarifas por año ─────────────────────────
create table public.paciente_tarifas (
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  anio        smallint not null check (anio between 2015 and 2100),
  valor       numeric(12, 2) not null check (valor >= 0),
  moneda      public.moneda not null default 'COP',
  primary key (paciente_id, anio)
);
comment on table public.paciente_tarifas is
  'Valor por consulta de cada paciente, por año (Valor 2026, Valor 2025…).';

-- ───────────────────────── Seguridad ─────────────────────────
alter table public.pacientes enable row level security;
alter table public.paciente_tarifas enable row level security;

grant select, insert, update, delete on public.pacientes, public.paciente_tarifas to authenticated;
grant all on public.pacientes, public.paciente_tarifas to service_role;

create policy pacientes_staff on public.pacientes
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));

create policy paciente_tarifas_staff on public.paciente_tarifas
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
