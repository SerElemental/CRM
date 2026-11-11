-- ============================================================================
-- 0007 · Conteos del filtro «Saldo»
-- ============================================================================
-- Añade a `pacientes_facetas` cuántos pacientes tienen sesiones por cobrar,
-- cuántos tienen sesiones prepagadas y cuántos están al día (ni lo uno ni lo
-- otro). Un mismo paciente puede contar en «por cobrar» y en «prepagadas».

create or replace view public.pacientes_facetas
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
