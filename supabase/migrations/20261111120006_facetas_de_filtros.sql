-- ============================================================================
-- 0006 · Conteos para los filtros del listado de pacientes
-- ============================================================================
-- Cuántos pacientes hay por cada valor de cada filtro (país, estado, flyer, plan
-- de trabajo, consentimiento). Se calcula en SQL: contarlo desde la app obligaría
-- a traer todas las filas, y esas consultas se cortan en 1.000.
-- `valor` nulo = el paciente no tiene ese dato.

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
    from public.pacientes group by consentimiento;

comment on view public.pacientes_facetas is
  'Conteo de pacientes por valor de cada filtro del listado.';

revoke all on public.pacientes_facetas from anon;
grant select on public.pacientes_facetas to authenticated, service_role;
