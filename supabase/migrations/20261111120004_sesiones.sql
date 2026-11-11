-- ============================================================================
-- 0004 · Sesiones del proceso terapéutico
-- ============================================================================
-- El Excel mezclaba dos cosas en una sola casilla (color + letra). Aquí van
-- separadas:
--   asistencia → ¿la sesión se tuvo?   realizada · pendiente · perdida
--   pago       → ¿cómo está el cobro?  pagada · paquete · sin_pagar · no_aplica
-- «paquete» = pagada por adelantado. Una sesión `pendiente` + `paquete` es una
-- sesión prepagada que el paciente todavía no ha tenido.

create type public.sesion_asistencia as enum ('realizada', 'pendiente', 'perdida');
create type public.sesion_pago as enum ('pagada', 'paquete', 'sin_pagar', 'no_aplica');
create type public.sesion_origen as enum ('excel', 'crm');

create table public.sesiones (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  numero      integer not null check (numero > 0),
  fecha       date,
  asistencia  public.sesion_asistencia not null,
  pago        public.sesion_pago not null,
  valor       numeric(12, 2) check (valor >= 0),
  moneda      public.moneda,
  nota        text,
  origen      public.sesion_origen not null default 'crm',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (paciente_id, numero)
);

comment on table public.sesiones is
  'Una fila por sesión. Las importadas del Excel no tienen fecha (solo orden).';

create trigger sesiones_set_updated_at
  before update on public.sesiones
  for each row execute function private.set_updated_at();

-- Mantiene pacientes.ultima_sesion con la sesión realizada más reciente.
create or replace function private.sesiones_actualizar_ultima()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asistencia = 'realizada' and new.fecha is not null then
    update public.pacientes
       set ultima_sesion = new.fecha
     where id = new.paciente_id
       and (ultima_sesion is null or ultima_sesion < new.fecha);
  end if;
  return new;
end;
$$;
revoke all on function private.sesiones_actualizar_ultima() from public;

create trigger sesiones_actualizar_ultima
  after insert or update of asistencia, fecha on public.sesiones
  for each row execute function private.sesiones_actualizar_ultima();

-- ───────────────────────── Seguridad ─────────────────────────
alter table public.sesiones enable row level security;
grant select, insert, update, delete on public.sesiones to authenticated;
grant all on public.sesiones to service_role;

create policy sesiones_staff on public.sesiones
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));

-- ───────────────────────── Resumen por paciente ─────────────────────────
-- Los conteos se hacen en SQL: una consulta desde la app corta en 1.000 filas.
create view public.pacientes_listado
with (security_invoker = true) as
select
  p.*,
  g.nombre as grupo_whatsapp,
  coalesce(s.total, 0)       as sesiones_total,
  coalesce(s.realizadas, 0)  as sesiones_realizadas,
  coalesce(s.por_cobrar, 0)  as sesiones_por_cobrar,
  coalesce(s.prepagadas, 0)  as sesiones_prepagadas,
  coalesce(s.perdidas, 0)    as sesiones_perdidas
from public.pacientes p
left join public.grupos_whatsapp g on g.id = p.grupo_whatsapp_id
left join lateral (
  select
    count(*)::int                                                           as total,
    (count(*) filter (where asistencia = 'realizada'))::int                 as realizadas,
    (count(*) filter (where pago = 'sin_pagar'))::int                       as por_cobrar,
    (count(*) filter (where asistencia = 'pendiente' and pago = 'paquete'))::int as prepagadas,
    (count(*) filter (where asistencia = 'perdida'))::int                   as perdidas
  from public.sesiones x
  where x.paciente_id = p.id
) s on true;

comment on view public.pacientes_listado is
  'Pacientes + nombre del grupo + contadores de sesiones. Base del listado y la ficha.';

grant select on public.pacientes_listado to authenticated, service_role;

-- ───────────────────────── Operaciones ─────────────────────────
-- Valor de la consulta del paciente para un año (si no hay, el más reciente anterior).
create or replace function private.tarifa_vigente(p_paciente uuid, p_fecha date)
returns table (valor numeric, moneda public.moneda)
language sql
stable
set search_path = ''
as $$
  select t.valor, t.moneda
    from public.paciente_tarifas t
   where t.paciente_id = p_paciente
     and t.anio <= extract(year from coalesce(p_fecha, current_date))
   order by t.anio desc
   limit 1;
$$;
revoke all on function private.tarifa_vigente(uuid, date) from public;
grant execute on function private.tarifa_vigente(uuid, date) to authenticated;

-- Registra una sesión. Si el paciente tiene sesiones prepagadas sin usar,
-- consume la más antigua; si no, crea una nueva con el siguiente número.
create or replace function public.registrar_sesion(
  p_paciente   uuid,
  p_fecha      date,
  p_asistencia public.sesion_asistencia,
  p_pago       public.sesion_pago,
  p_nota       text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id     uuid;
  v_valor  numeric;
  v_moneda public.moneda;
begin
  if p_asistencia = 'pendiente' then
    raise exception 'Una sesión registrada debe ser realizada o perdida.';
  end if;

  select id into v_id
    from public.sesiones
   where paciente_id = p_paciente and asistencia = 'pendiente' and pago = 'paquete'
   order by numero
   limit 1
   for update;

  if v_id is not null then
    update public.sesiones
       set asistencia = p_asistencia,
           fecha = p_fecha,
           nota = coalesce(nullif(btrim(p_nota), ''), nota)
     where id = v_id;
    return v_id;
  end if;

  select t.valor, t.moneda into v_valor, v_moneda
    from private.tarifa_vigente(p_paciente, p_fecha) t;

  insert into public.sesiones (paciente_id, numero, fecha, asistencia, pago, valor, moneda, nota)
  select p_paciente,
         coalesce(max(numero), 0) + 1,
         p_fecha, p_asistencia, p_pago, v_valor, v_moneda,
         nullif(btrim(p_nota), '')
    from public.sesiones
   where paciente_id = p_paciente
  returning id into v_id;

  return v_id;
end;
$$;

-- Registra un paquete: N sesiones pagadas por adelantado, pendientes por tener.
create or replace function public.registrar_paquete(
  p_paciente uuid,
  p_cantidad integer,
  p_nota     text default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_base   integer;
  v_valor  numeric;
  v_moneda public.moneda;
begin
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 50 then
    raise exception 'La cantidad de sesiones del paquete debe estar entre 1 y 50.';
  end if;

  select coalesce(max(numero), 0) into v_base
    from public.sesiones where paciente_id = p_paciente;

  select t.valor, t.moneda into v_valor, v_moneda
    from private.tarifa_vigente(p_paciente, current_date) t;

  insert into public.sesiones (paciente_id, numero, asistencia, pago, valor, moneda, nota)
  select p_paciente, v_base + n, 'pendiente', 'paquete', v_valor, v_moneda,
         nullif(btrim(p_nota), '')
    from generate_series(1, p_cantidad) as n;

  return p_cantidad;
end;
$$;

revoke all on function public.registrar_sesion(uuid, date, public.sesion_asistencia, public.sesion_pago, text) from public, anon;
revoke all on function public.registrar_paquete(uuid, integer, text) from public, anon;
grant execute on function public.registrar_sesion(uuid, date, public.sesion_asistencia, public.sesion_pago, text) to authenticated;
grant execute on function public.registrar_paquete(uuid, integer, text) to authenticated;
