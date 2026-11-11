-- ============================================================================
-- 0009 · Módulo de facturas
-- ============================================================================
-- Marcela factura desde dos empresas: la de Colombia (cuenta de cobro, COP) y la
-- de EE. UU. (invoice, USD). Cada documento:
--   · lleva un consecutivo por empresa y año (INV-2026-0001, CC-2026-0001);
--   · guarda una «foto» de los datos de la empresa, del cliente y de los
--     renglones, para que el PDF salga siempre igual aunque luego cambien;
--   · no se edita ni se borra: se marca pagado o se anula.
-- Por eso el equipo solo puede LEER estas tablas; todo cambio pasa por las
-- funciones de abajo, que validan y numeran de forma atómica.

-- ───────────────────────── Documento del paciente ─────────────────────────
-- (Las vistas usan `p.*`: hay que volver a crearlas para que vean la columna.)
drop view public.pacientes_facetas;
drop view public.pacientes_listado;

alter table public.pacientes add column documento text;
comment on column public.pacientes.documento is
  'Documento de identidad tal como va en una factura: «C.C. 1.234.567», «NIT …», «Passport …».';

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

create view public.pacientes_facetas
with (security_invoker = true) as
  select 'pais'::text as faceta, pais as valor, count(*)::int as total
    from public.pacientes group by pais
  union all
  select 'estado', estado::text, count(*)::int
    from public.pacientes group by estado
  union all
  select 'flyer', case when flyer_enviado then 'si' else 'no' end, count(*)::int
    from public.pacientes group by flyer_enviado
  union all
  select 'plan', plan_trabajo_enviado::text, count(*)::int
    from public.pacientes group by plan_trabajo_enviado
  union all
  select 'consentimiento', case when consentimiento then 'si' else 'no' end, count(*)::int
    from public.pacientes group by consentimiento
  union all
  select 'saldo', v.valor, count(*)::int
    from public.pacientes_listado l
    cross join lateral (values
      ('por_cobrar', l.sesiones_por_cobrar > 0),
      ('prepagadas', l.sesiones_prepagadas > 0),
      ('al_dia', l.sesiones_por_cobrar = 0 and l.sesiones_prepagadas = 0)
    ) as v (valor, cumple)
   where v.cumple
   group by v.valor;

comment on view public.pacientes_facetas is
  'Conteo de pacientes por valor de cada filtro del listado.';

revoke all on public.pacientes_listado, public.pacientes_facetas from anon;
grant select on public.pacientes_listado, public.pacientes_facetas to authenticated, service_role;

-- ───────────────────────── Empresas que facturan ─────────────────────────
create table public.emisores (
  clave      text primary key check (clave ~ '^[a-z]{2,10}$'),
  -- Razón social, identificación, dirección, datos de pago, idioma, moneda,
  -- prefijo… (la forma está en `src/lib/facturas/tipos.ts`, tipo Emisor).
  datos      jsonb not null,
  orden      smallint not null default 0,
  activo     boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.emisores is
  'Empresas desde las que se factura. Sus datos (incluidas las cuentas bancarias) viven aquí, no en el código: se cargan con `npm run cargar:emisores`.';

create table public.factura_consecutivos (
  emisor_clave text not null references public.emisores (clave) on delete cascade,
  anio         smallint not null,
  ultimo       integer not null default 0 check (ultimo >= 0),
  primary key (emisor_clave, anio)
);
comment on table public.factura_consecutivos is
  'Último consecutivo usado por empresa y año.';

-- ───────────────────────── Facturas ─────────────────────────
create type public.factura_estado as enum ('emitida', 'pagada', 'anulada');

create table public.facturas (
  id             uuid primary key default gen_random_uuid(),
  emisor_clave   text not null references public.emisores (clave),
  paciente_id    uuid references public.pacientes (id) on delete set null,
  numero         text not null unique,
  anio           smallint not null,
  consecutivo    integer not null,
  fecha          date not null,
  moneda         public.moneda not null,
  total          numeric(14, 2) not null check (total >= 0),
  -- «Fotos» del momento de emitir:
  cliente        jsonb not null,
  emisor         jsonb not null,
  items          jsonb not null,
  notas          text,
  estado         public.factura_estado not null default 'emitida',
  pagada_el      date,
  anulada_el     timestamptz,
  anulada_motivo text,
  creada_por     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (emisor_clave, anio, consecutivo)
);
comment on table public.facturas is
  'Documentos de cobro emitidos. Inmutables: solo cambian de estado (pagada / anulada).';
comment on column public.facturas.paciente_id is
  'Paciente al que corresponde. Vacío si se le cobra a un tercero que no es paciente (una empresa, un taller).';

create index facturas_fecha_idx on public.facturas (fecha desc);
create index facturas_paciente_idx on public.facturas (paciente_id);

create trigger facturas_set_updated_at
  before update on public.facturas
  for each row execute function private.set_updated_at();

-- Qué sesiones cubre cada factura. Una sesión solo puede estar en UNA factura
-- vigente (al anular, se libera).
create table public.factura_sesiones (
  factura_id   uuid not null references public.facturas (id) on delete cascade,
  sesion_id    uuid not null unique references public.sesiones (id) on delete cascade,
  -- La sesión estaba «sin pagar» y fue esta factura, al marcarse pagada, la que
  -- la dejó «pagada». Sirve para deshacerlo si se quita el pago o se anula.
  marco_pagada boolean not null default false,
  primary key (factura_id, sesion_id)
);

-- ───────────────────────── Seguridad: solo lectura para el equipo ─────────────────────────
alter table public.emisores enable row level security;
alter table public.factura_consecutivos enable row level security;
alter table public.facturas enable row level security;
alter table public.factura_sesiones enable row level security;

revoke all on public.emisores, public.factura_consecutivos, public.facturas, public.factura_sesiones
  from anon, authenticated;
grant select on public.emisores, public.factura_consecutivos, public.facturas, public.factura_sesiones
  to authenticated;
grant all on public.emisores, public.factura_consecutivos, public.facturas, public.factura_sesiones
  to service_role;

create policy emisores_leer on public.emisores
  for select to authenticated using ((select private.es_staff()));
create policy factura_consecutivos_leer on public.factura_consecutivos
  for select to authenticated using ((select private.es_staff()));
create policy facturas_leer on public.facturas
  for select to authenticated using ((select private.es_staff()));
create policy factura_sesiones_leer on public.factura_sesiones
  for select to authenticated using ((select private.es_staff()));

-- ───────────────────────── Vistas ─────────────────────────
create view public.facturas_listado
with (security_invoker = true) as
select
  f.id, f.numero, f.fecha, f.emisor_clave, f.paciente_id, f.moneda, f.total, f.estado,
  f.pagada_el, f.created_at,
  f.cliente ->> 'nombre' as cliente_nombre,
  p.nombre_completo      as paciente_nombre,
  lower(extensions.unaccent(
    concat_ws(' ', f.numero, f.cliente ->> 'nombre', p.nombre_completo)
  )) as busqueda
from public.facturas f
left join public.pacientes p on p.id = f.paciente_id;

comment on view public.facturas_listado is
  'Facturas con el nombre del cliente y del paciente, para el repositorio y la ficha.';

-- Sesiones que tiene sentido ofrecer al facturar: ya ocurrieron, no están en
-- otra factura y, o se registraron en el CRM, o venían del Excel sin pagar.
-- (Las miles de sesiones antiguas ya pagadas no se ofrecen: serían ruido.)
create view public.sesiones_por_facturar
with (security_invoker = true) as
select s.*
  from public.sesiones s
 where s.asistencia <> 'pendiente'
   and (s.origen = 'crm' or s.pago = 'sin_pagar')
   and not exists (select 1 from public.factura_sesiones fs where fs.sesion_id = s.id);

revoke all on public.facturas_listado, public.sesiones_por_facturar from anon;
grant select on public.facturas_listado, public.sesiones_por_facturar to authenticated, service_role;

-- ───────────────────────── Operaciones ─────────────────────────
-- Emite una factura: valida, toma el siguiente consecutivo de la empresa en el
-- año de la fecha y guarda las «fotos». Todo o nada.
create or replace function public.emitir_factura(
  p_emisor   text,
  p_paciente uuid,
  p_fecha    date,
  p_cliente  jsonb,
  p_items    jsonb,
  p_notas    text default null,
  p_sesiones uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor  jsonb;
  v_anio    smallint;
  v_n       integer;
  v_total   numeric;
  v_id      uuid;
  v_ligadas integer;
begin
  if not private.es_staff() then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;
  if p_fecha is null then
    raise exception 'Falta la fecha de la factura.';
  end if;
  if nullif(btrim(p_cliente ->> 'nombre'), '') is null then
    raise exception 'Falta el nombre de a quién se le cobra.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La factura necesita al menos un renglón.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
     where nullif(btrim(i ->> 'descripcion'), '') is null
        or (i ->> 'cantidad')::numeric <= 0
        or (i ->> 'valorUnitario')::numeric < 0
  ) then
    raise exception 'Cada renglón necesita descripción, cantidad mayor que cero y un valor.';
  end if;

  select datos into v_emisor from public.emisores where clave = p_emisor and activo;
  if v_emisor is null then
    raise exception 'No existe la empresa «%».', p_emisor;
  end if;

  select sum((i ->> 'cantidad')::numeric * (i ->> 'valorUnitario')::numeric)
    into v_total
    from jsonb_array_elements(p_items) i;

  v_anio := extract(year from p_fecha);
  insert into public.factura_consecutivos as c (emisor_clave, anio, ultimo)
  values (p_emisor, v_anio, 1)
  on conflict (emisor_clave, anio) do update set ultimo = c.ultimo + 1
  returning ultimo into v_n;

  insert into public.facturas
    (emisor_clave, paciente_id, numero, anio, consecutivo, fecha, moneda, total,
     cliente, emisor, items, notas, creada_por)
  values
    (p_emisor, p_paciente,
     (v_emisor ->> 'prefijo') || '-' || v_anio || '-' || lpad(v_n::text, 4, '0'),
     v_anio, v_n, p_fecha, (v_emisor ->> 'moneda')::public.moneda, v_total,
     p_cliente, v_emisor, p_items, nullif(btrim(p_notas), ''), (select auth.uid()))
  returning id into v_id;

  if coalesce(cardinality(p_sesiones), 0) > 0 then
    begin
      insert into public.factura_sesiones (factura_id, sesion_id)
      select v_id, s.id
        from public.sesiones s
       where s.id = any (p_sesiones) and s.paciente_id = p_paciente;
      get diagnostics v_ligadas = row_count;
    exception when unique_violation then
      raise exception 'Alguna de las sesiones ya está en otra factura.';
    end;
    if v_ligadas <> cardinality(p_sesiones) then
      raise exception 'Alguna de las sesiones no es de este paciente.';
    end if;
  end if;

  return v_id;
end;
$$;

-- Marca una factura como pagada y, con ella, las sesiones que cubría y seguían sin pagar.
create or replace function public.marcar_factura_pagada(p_factura uuid, p_fecha date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_staff() then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;
  update public.facturas
     set estado = 'pagada', pagada_el = coalesce(p_fecha, current_date)
   where id = p_factura and estado = 'emitida';
  if not found then
    raise exception 'Solo se puede marcar como pagada una factura emitida.';
  end if;
  with cambiadas as (
    update public.sesiones s
       set pago = 'pagada'
      from public.factura_sesiones fs
     where fs.factura_id = p_factura and fs.sesion_id = s.id and s.pago = 'sin_pagar'
    returning s.id
  )
  update public.factura_sesiones fs
     set marco_pagada = true
   where fs.factura_id = p_factura and fs.sesion_id in (select id from cambiadas);
end;
$$;

-- Deshace lo anterior: las sesiones que esta factura dejó pagadas vuelven a «sin pagar».
create or replace function private.revertir_pago_de_sesiones(p_factura uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with marcadas as (
    update public.factura_sesiones fs
       set marco_pagada = false
     where fs.factura_id = p_factura and fs.marco_pagada
    returning fs.sesion_id
  )
  update public.sesiones s
     set pago = 'sin_pagar'
   where s.id in (select sesion_id from marcadas) and s.pago = 'pagada';
$$;
revoke all on function private.revertir_pago_de_sesiones(uuid) from public;

-- Devuelve una factura pagada a «emitida» (por si se marcó por error) y, con ella, sus sesiones.
create or replace function public.reabrir_factura(p_factura uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_staff() then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;
  update public.facturas set estado = 'emitida', pagada_el = null
   where id = p_factura and estado = 'pagada';
  if not found then
    raise exception 'Solo se puede reabrir una factura pagada.';
  end if;
  perform private.revertir_pago_de_sesiones(p_factura);
end;
$$;

-- Anula una factura: conserva su número (no deja huecos), libera sus sesiones y,
-- si estaba pagada, las devuelve a «sin pagar».
create or replace function public.anular_factura(p_factura uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_staff() then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Escribe el motivo de la anulación.';
  end if;
  update public.facturas
     set estado = 'anulada', anulada_el = now(), anulada_motivo = btrim(p_motivo), pagada_el = null
   where id = p_factura and estado <> 'anulada';
  if not found then
    raise exception 'La factura no existe o ya estaba anulada.';
  end if;
  perform private.revertir_pago_de_sesiones(p_factura);
  delete from public.factura_sesiones where factura_id = p_factura;
end;
$$;

-- Totales del repositorio con los mismos filtros del listado (las sumas van en
-- SQL: una consulta desde la app se corta en 1.000 filas). Sin filtro de estado,
-- las anuladas no suman.
create or replace function public.facturas_totales(
  p_desde    date default null,
  p_hasta    date default null,
  p_emisor   text default null,
  p_estado   public.factura_estado default null,
  p_busqueda text default null,
  p_paciente uuid default null
)
returns table (moneda public.moneda, cantidad integer, total numeric)
language sql
stable
set search_path = ''
as $$
  select f.moneda, count(*)::int, sum(f.total)
    from public.facturas_listado f
   where (p_desde is null or f.fecha >= p_desde)
     and (p_hasta is null or f.fecha <= p_hasta)
     and (p_emisor is null or f.emisor_clave = p_emisor)
     and (p_paciente is null or f.paciente_id = p_paciente)
     and (case when p_estado is null then f.estado <> 'anulada' else f.estado = p_estado end)
     and (p_busqueda is null or f.busqueda like '%' || p_busqueda || '%')
   group by f.moneda;
$$;

revoke all on function public.emitir_factura(text, uuid, date, jsonb, jsonb, text, uuid[]) from public, anon;
revoke all on function public.marcar_factura_pagada(uuid, date) from public, anon;
revoke all on function public.reabrir_factura(uuid) from public, anon;
revoke all on function public.anular_factura(uuid, text) from public, anon;
revoke all on function public.facturas_totales(date, date, text, public.factura_estado, text, uuid) from public, anon;
grant execute on function public.emitir_factura(text, uuid, date, jsonb, jsonb, text, uuid[]) to authenticated;
grant execute on function public.marcar_factura_pagada(uuid, date) to authenticated;
grant execute on function public.reabrir_factura(uuid) to authenticated;
grant execute on function public.anular_factura(uuid, text) to authenticated;
grant execute on function public.facturas_totales(date, date, text, public.factura_estado, text, uuid) to authenticated;
