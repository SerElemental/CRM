-- ============================================================================
-- 0008 · Contacto de emergencia del paciente
-- ============================================================================
-- Nombre, teléfono y relación con el paciente. Si la relación es «otro», se
-- escribe cuál en `emergencia_relacion_otra`.
--
-- `pacientes_listado` se definió con `p.*`, y Postgres fija las columnas de una
-- vista al crearla: para que vea las columnas nuevas hay que volver a crearla
-- (y con ella `pacientes_facetas`, que depende de la primera).

drop view public.pacientes_facetas;
drop view public.pacientes_listado;

alter table public.pacientes
  add column emergencia_nombre        text,
  add column emergencia_telefono      text,
  add column emergencia_relacion      text
    check (emergencia_relacion in ('mama', 'papa', 'esposo', 'hijo', 'otro')),
  add column emergencia_relacion_otra text;

comment on column public.pacientes.emergencia_relacion is
  'Relación del contacto de emergencia con el paciente: mama, papa, esposo, hijo u otro.';
comment on column public.pacientes.emergencia_relacion_otra is
  'Cuál es la relación cuando `emergencia_relacion` = otro.';

-- ───────────────────────── Vistas (mismas definiciones) ─────────────────────────
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
