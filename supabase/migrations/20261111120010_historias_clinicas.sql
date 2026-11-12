-- ============================================================================
-- 0010 · Historias clínicas
-- ============================================================================
-- Una historia por paciente, con la misma estructura del «Registro de atención
-- psicológica» que Marcela llevaba en Word:
--   · datos de identificación y secciones 1 a 5 (valoración inicial);
--   · concepto general y plan de trabajo (objetivos);
--   · una nota por sesión (antes, el bloque «Observaciones»);
--   · adjuntos (genograma, consentimiento, el Word original).
--
-- Reglas que la base de datos hace cumplir, no solo la pantalla (Res. 1995 de
-- 1999 y Res. 839 de 2017):
--   · una nota FIRMADA no se modifica ni se borra: se corrige con una adenda;
--   · nada de la historia se elimina (ni la historia, ni adendas, ni adjuntos);
--   · cada cambio queda en `historia_cambios`, que el equipo solo puede leer.

create type public.historia_origen as enum ('crm', 'word');
create type public.nota_estado as enum ('borrador', 'firmada');
create type public.objetivo_estado as enum ('pendiente', 'en_curso', 'trabajado');

create sequence public.historias_numero_seq;

-- ───────────────────────── Historia ─────────────────────────
create table public.historias (
  paciente_id              uuid primary key references public.pacientes (id) on delete restrict,
  numero                   integer not null unique default nextval('public.historias_numero_seq'),
  -- Identificación (nombre, teléfono, correo y documento viven en `pacientes`)
  fecha_nacimiento         date,
  edad_texto               text,
  direccion                text,
  seguridad_social         text,
  estado_civil             text,
  escolaridad              text,
  ocupacion                text,
  remision                 text,
  enfermedades             text,
  profesional              text not null default 'Marcela Salazar',
  fecha_consulta           date,
  fecha_consulta_texto     text,
  -- Valoración inicial
  motivo_consulta          text,
  antecedentes             text,
  nucleo_familiar          text,
  relaciones_sociales      text,
  relaciones_profesionales text,
  metas_personales         text,
  metas_laborales          text,
  -- Concepto y plan
  concepto_general         text,
  herramientas_apoyo       text,
  -- Importación desde Word
  origen                   public.historia_origen not null default 'crm',
  archivo_origen           text,
  texto_origen             jsonb,
  avisos                   jsonb not null default '[]',
  revisada_el              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.historias is
  'Historia clínica de cada paciente (1:1). No se elimina: `on delete restrict` protege también al paciente.';
comment on column public.historias.edad_texto is
  'Edad tal como venía en el Word («34 años»). Si hay fecha de nacimiento, la edad se calcula.';
comment on column public.historias.fecha_consulta_texto is
  'Texto original de la fecha de consulta cuando no se pudo convertir a fecha.';
comment on column public.historias.texto_origen is
  'Párrafos del Word original, para compararlos en la revisión de la importación.';
comment on column public.historias.avisos is
  'Lo que la importación no pudo resolver sola (fechas que faltan, numeración ajustada…).';
comment on column public.historias.revisada_el is
  'Cuándo se confirmó la revisión de una historia importada. Vacío = por revisar.';

create trigger historias_set_updated_at
  before update on public.historias
  for each row execute function private.set_updated_at();

-- ───────────────────────── Notas de sesión ─────────────────────────
create table public.historia_notas (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid not null references public.historias (paciente_id) on delete restrict,
  sesion_id         uuid unique references public.sesiones (id) on delete set null,
  numero            integer not null check (numero > 0),
  fecha             date,
  fecha_texto       text,
  hora              time,
  duracion_min      smallint check (duracion_min between 5 and 480),
  modalidad         public.modalidad,
  formato           text not null default 'ser_elemental' check (formato in ('ser_elemental', 'soap', 'dap')),
  -- Los campos dependen del formato (ver `src/lib/historias/formatos.ts`).
  campos            jsonb not null default '{}',
  objetivos         uuid[] not null default '{}',
  estado            public.nota_estado not null default 'borrador',
  firmada_el        timestamptz,
  firmada_por       uuid references auth.users (id) on delete set null,
  firmada_nombre    text,
  origen            public.historia_origen not null default 'crm',
  encabezado_origen text,
  creada_por        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (paciente_id, numero)
);

comment on table public.historia_notas is
  'Nota de evolución de una sesión. En borrador se edita; firmada queda bloqueada.';
comment on column public.historia_notas.sesion_id is
  'Sesión de la ficha del paciente (asistencia y cobro) a la que corresponde, si se enlazó.';
comment on column public.historia_notas.fecha_texto is
  'Fecha tal como venía en el Word («ABRIL 21»): el año se deduce y hay que poder comprobarlo.';
comment on column public.historia_notas.encabezado_origen is
  'Encabezado original de la sesión en el Word («SESIÓN 5 ABRIL 1:»).';

create index historia_notas_paciente_idx on public.historia_notas (paciente_id, numero desc);

create trigger historia_notas_set_updated_at
  before update on public.historia_notas
  for each row execute function private.set_updated_at();

-- El candado: firma con sello del servidor y bloqueo de lo firmado.
create or replace function private.historia_notas_candado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_nombre  text;
  v_libres  text[] := array['sesion_id', 'updated_at', 'firmada_por', 'creada_por'];
begin
  if tg_op = 'DELETE' then
    if old.estado = 'firmada' then
      raise exception 'Una nota firmada no se puede eliminar.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.estado = 'firmada' then
    -- Solo pueden cambiar los enlaces que mantiene la propia base (p. ej. si se borra la sesión).
    if (to_jsonb(new) - v_libres) is distinct from (to_jsonb(old) - v_libres) then
      raise exception 'Una nota firmada no se puede modificar: agrega una adenda.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.estado = 'firmada' then
    if new.origen = 'crm' then
      if new.fecha is null then
        raise exception 'La nota necesita la fecha de la sesión para firmarse.';
      end if;
      if not exists (select 1 from jsonb_each_text(new.campos) c where btrim(c.value) <> '') then
        raise exception 'La nota está vacía: escribe el registro de la sesión antes de firmar.';
      end if;
    end if;
    new.firmada_el := now();
    if v_uid is not null then
      select nombre into v_nombre from public.profiles where id = v_uid;
      new.firmada_por := v_uid;
      new.firmada_nombre := coalesce(nullif(btrim(v_nombre), ''), 'Equipo Ser Elemental');
    else
      new.firmada_nombre := coalesce(new.firmada_nombre, 'Importación');
    end if;
  else
    new.firmada_el := null;
    new.firmada_por := null;
    new.firmada_nombre := null;
  end if;
  return new;
end;
$$;
revoke all on function private.historia_notas_candado() from public;

create trigger historia_notas_candado
  before insert or update or delete on public.historia_notas
  for each row execute function private.historia_notas_candado();

-- ───────────────────────── Adendas ─────────────────────────
create table public.historia_adendas (
  id           uuid primary key default gen_random_uuid(),
  nota_id      uuid not null references public.historia_notas (id) on delete restrict,
  texto        text not null check (length(btrim(texto)) > 0),
  autor        uuid references auth.users (id) on delete set null,
  autor_nombre text,
  created_at   timestamptz not null default now()
);
comment on table public.historia_adendas is
  'Aclaraciones o correcciones a una nota firmada. Se agregan; no se editan ni se borran.';

create index historia_adendas_nota_idx on public.historia_adendas (nota_id, created_at);

create or replace function private.historia_adendas_sello()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_nombre text;
begin
  if not exists (select 1 from public.historia_notas where id = new.nota_id and estado = 'firmada') then
    raise exception 'Las adendas son para notas firmadas: un borrador se edita directamente.';
  end if;
  select nombre into v_nombre from public.profiles where id = v_uid;
  new.autor := v_uid;
  new.autor_nombre := coalesce(nullif(btrim(v_nombre), ''), 'Equipo Ser Elemental');
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.historia_adendas_sello() from public;

create trigger historia_adendas_sello
  before insert on public.historia_adendas
  for each row execute function private.historia_adendas_sello();

-- ───────────────────────── Plan de trabajo ─────────────────────────
create table public.historia_objetivos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.historias (paciente_id) on delete restrict,
  nombre      text not null check (length(btrim(nombre)) > 0),
  estado      public.objetivo_estado not null default 'pendiente',
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.historia_objetivos is 'Objetivos del plan de trabajo de cada historia.';

create index historia_objetivos_paciente_idx on public.historia_objetivos (paciente_id, orden);

create trigger historia_objetivos_set_updated_at
  before update on public.historia_objetivos
  for each row execute function private.set_updated_at();

-- ───────────────────────── Adjuntos ─────────────────────────
create table public.historia_adjuntos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.historias (paciente_id) on delete restrict,
  nombre      text not null check (length(btrim(nombre)) > 0),
  -- Ruta dentro del depósito privado `historias` de Supabase Storage.
  ruta        text not null unique,
  tipo        text,
  tamano      integer check (tamano >= 0),
  subido_por  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on table public.historia_adjuntos is
  'Archivos de la historia (genograma, consentimiento, Word original). No se eliminan.';

create index historia_adjuntos_paciente_idx on public.historia_adjuntos (paciente_id, created_at);

-- ───────────────────────── Historial de cambios ─────────────────────────
create table public.historia_cambios (
  id             bigint generated always as identity primary key,
  paciente_id    uuid not null references public.historias (paciente_id) on delete restrict,
  cuando         timestamptz not null default now(),
  usuario        uuid references auth.users (id) on delete set null,
  usuario_nombre text not null,
  accion         text not null,
  campo          text,
  detalle        text not null,
  anterior       text
);
comment on table public.historia_cambios is
  'Registro automático de lo que pasa con cada historia. Lo escriben los disparadores; el equipo solo lo lee.';
comment on column public.historia_cambios.anterior is
  'Texto que tenía la sección antes del cambio: así ninguna versión se pierde.';

create index historia_cambios_paciente_idx on public.historia_cambios (paciente_id, cuando desc);

-- Anota un cambio. Las ediciones seguidas de un mismo campo (el autoguardado)
-- cuentan como una sola: se conserva la primera, que trae la versión anterior.
create or replace function private.historia_anotar(
  p_paciente uuid,
  p_accion   text,
  p_detalle  text,
  p_campo    text default null,
  p_anterior text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_nombre text;
begin
  if p_campo is not null and exists (
    select 1 from public.historia_cambios c
     where c.paciente_id = p_paciente and c.campo = p_campo
       and c.usuario is not distinct from v_uid
       and c.cuando > now() - interval '30 minutes'
  ) then
    return;
  end if;
  if v_uid is not null then
    select nombre into v_nombre from public.profiles where id = v_uid;
  end if;
  insert into public.historia_cambios (paciente_id, usuario, usuario_nombre, accion, campo, detalle, anterior)
  values (
    p_paciente, v_uid,
    coalesce(nullif(btrim(v_nombre), ''), case when v_uid is null then 'Importación' else 'Equipo Ser Elemental' end),
    p_accion, p_campo, p_detalle, p_anterior
  );
end;
$$;
revoke all on function private.historia_anotar(uuid, text, text, text, text) from public;

create or replace function private.historias_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k           text;
  v_old       jsonb;
  v_new       jsonb;
  v_secciones jsonb := jsonb_build_object(
    'motivo_consulta', 'Motivo de consulta',
    'antecedentes', 'Antecedentes clínicos o terapéuticos',
    'nucleo_familiar', 'Composición del núcleo familiar',
    'relaciones_sociales', 'Relaciones sociales',
    'relaciones_profesionales', 'Relaciones académico-profesionales',
    'metas_personales', 'Metas personales',
    'metas_laborales', 'Metas laborales',
    'concepto_general', 'Concepto general',
    'herramientas_apoyo', 'Herramientas de apoyo'
  );
  v_identidad text[] := array[
    'fecha_nacimiento', 'edad_texto', 'direccion', 'seguridad_social', 'estado_civil', 'escolaridad',
    'ocupacion', 'remision', 'enfermedades', 'profesional', 'fecha_consulta', 'fecha_consulta_texto'
  ];
begin
  if tg_op = 'INSERT' then
    perform private.historia_anotar(
      new.paciente_id, 'abierta',
      case when new.origen = 'word'
           then 'importó la historia desde el archivo de Word «' || coalesce(new.archivo_origen, 'sin nombre') || '».'
           else 'abrió la historia clínica.' end
    );
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  for k in select jsonb_object_keys(v_secciones) loop
    if (v_old ->> k) is distinct from (v_new ->> k) then
      perform private.historia_anotar(
        new.paciente_id, 'seccion', 'editó «' || (v_secciones ->> k) || '».', k, v_old ->> k
      );
    end if;
  end loop;
  foreach k in array v_identidad loop
    if (v_old ->> k) is distinct from (v_new ->> k) then
      perform private.historia_anotar(new.paciente_id, 'identificacion', 'editó los datos de identificación.', 'identificacion');
      exit;
    end if;
  end loop;
  if old.revisada_el is null and new.revisada_el is not null then
    perform private.historia_anotar(new.paciente_id, 'revisada', 'confirmó la revisión de la historia importada. Sus notas quedaron firmadas.');
  end if;
  return new;
end;
$$;
revoke all on function private.historias_auditar() from public;

create trigger historias_auditar
  after insert or update on public.historias
  for each row execute function private.historias_auditar();

-- Las notas importadas no se anotan una por una: basta el renglón de la importación.
create or replace function private.historia_notas_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.historia_anotar(old.paciente_id, 'nota_eliminada', 'eliminó el borrador de la sesión ' || old.numero || '.');
    return old;
  end if;
  if new.origen <> 'crm' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.historia_anotar(new.paciente_id, 'nota_creada', 'creó la nota de la sesión ' || new.numero || ' (borrador).');
  elsif old.estado = 'borrador' and new.estado = 'firmada' then
    perform private.historia_anotar(new.paciente_id, 'nota_firmada', 'firmó la nota de la sesión ' || new.numero || '. Quedó bloqueada.');
  end if;
  return new;
end;
$$;
revoke all on function private.historia_notas_auditar() from public;

create trigger historia_notas_auditar
  after insert or update or delete on public.historia_notas
  for each row execute function private.historia_notas_auditar();

create or replace function private.historia_detalles_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nota public.historia_notas;
begin
  if tg_table_name = 'historia_adendas' then
    select * into v_nota from public.historia_notas where id = new.nota_id;
    perform private.historia_anotar(v_nota.paciente_id, 'adenda', 'agregó una adenda a la nota de la sesión ' || v_nota.numero || '.');
  elsif tg_table_name = 'historia_adjuntos' then
    perform private.historia_anotar(new.paciente_id, 'adjunto', 'adjuntó «' || new.nombre || '».');
  elsif tg_table_name = 'historia_objetivos' then
    -- Los objetivos que llegan con la importación no se anotan uno por uno.
    if (select auth.uid()) is null then
      return new;
    end if;
    if tg_op = 'INSERT' then
      perform private.historia_anotar(new.paciente_id, 'objetivo', 'agregó al plan de trabajo el objetivo «' || new.nombre || '».');
    elsif old.estado is distinct from new.estado then
      perform private.historia_anotar(
        new.paciente_id, 'objetivo',
        'marcó el objetivo «' || new.nombre || '» como ' ||
        case new.estado when 'trabajado' then 'trabajado' when 'en_curso' then 'en curso' else 'pendiente' end || '.'
      );
    elsif old.nombre is distinct from new.nombre then
      perform private.historia_anotar(new.paciente_id, 'objetivo', 'cambió el objetivo «' || old.nombre || '» por «' || new.nombre || '».');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.historia_detalles_auditar() from public;

create trigger historia_adendas_auditar
  after insert on public.historia_adendas
  for each row execute function private.historia_detalles_auditar();
create trigger historia_adjuntos_auditar
  after insert on public.historia_adjuntos
  for each row execute function private.historia_detalles_auditar();
create trigger historia_objetivos_auditar
  after insert or update on public.historia_objetivos
  for each row execute function private.historia_detalles_auditar();

-- ───────────────────────── Seguridad ─────────────────────────
alter table public.historias enable row level security;
alter table public.historia_notas enable row level security;
alter table public.historia_adendas enable row level security;
alter table public.historia_objetivos enable row level security;
alter table public.historia_adjuntos enable row level security;
alter table public.historia_cambios enable row level security;

revoke all on public.historias, public.historia_notas, public.historia_adendas,
  public.historia_objetivos, public.historia_adjuntos, public.historia_cambios
  from anon, authenticated;
revoke all on sequence public.historias_numero_seq from anon;

-- Lo que NO se concede es parte del diseño: nadie borra historias, adendas,
-- objetivos ni adjuntos, y el historial de cambios es de solo lectura.
grant select, insert, update on public.historias to authenticated;
grant select, insert, update, delete on public.historia_notas to authenticated;
grant select, insert on public.historia_adendas to authenticated;
grant select, insert, update on public.historia_objetivos to authenticated;
grant select, insert on public.historia_adjuntos to authenticated;
grant select on public.historia_cambios to authenticated;
grant usage, select on sequence public.historias_numero_seq to authenticated, service_role;
grant all on public.historias, public.historia_notas, public.historia_adendas,
  public.historia_objetivos, public.historia_adjuntos, public.historia_cambios
  to service_role;

create policy historias_staff on public.historias
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
create policy historia_notas_staff on public.historia_notas
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
create policy historia_adendas_staff on public.historia_adendas
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
create policy historia_objetivos_staff on public.historia_objetivos
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
create policy historia_adjuntos_staff on public.historia_adjuntos
  for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));
create policy historia_cambios_leer on public.historia_cambios
  for select to authenticated using ((select private.es_staff()));

-- ───────────────────────── Listado ─────────────────────────
create view public.historias_listado
with (security_invoker = true) as
select
  h.paciente_id, h.numero, h.origen, h.archivo_origen, h.revisada_el, h.created_at,
  p.nombre_completo, p.documento, p.estado as paciente_estado, p.busqueda,
  coalesce(n.total, 0)      as notas_total,
  coalesce(n.firmadas, 0)   as notas_firmadas,
  coalesce(n.borradores, 0) as notas_borrador,
  n.ultima_nota,
  v.vacias                  as secciones_vacias,
  jsonb_array_length(h.avisos) as avisos_total,
  case
    when h.origen = 'word' and h.revisada_el is null then 'por_revisar'
    when v.vacias > 0 then 'incompleta'
    else 'completa'
  end as estado
from public.historias h
join public.pacientes p on p.id = h.paciente_id
left join lateral (
  select
    count(*)::int                                                              as total,
    (count(*) filter (where x.estado = 'firmada'))::int                        as firmadas,
    -- Las notas importadas que esperan la revisión no son «borradores por firmar».
    (count(*) filter (where x.estado = 'borrador' and x.origen = 'crm'))::int  as borradores,
    max(x.fecha)                                                               as ultima_nota
  from public.historia_notas x
  where x.paciente_id = h.paciente_id
) n on true
cross join lateral (
  select count(*)::int as vacias
    from unnest(array[
      h.motivo_consulta, h.antecedentes, h.nucleo_familiar,
      h.relaciones_sociales, h.relaciones_profesionales, h.concepto_general
    ]) as t (texto)
   where nullif(btrim(t.texto), '') is null
) v;

comment on view public.historias_listado is
  'Una fila por historia con su paciente, contadores de notas y estado (completa, incompleta, por revisar).';

revoke all on public.historias_listado from anon;
grant select on public.historias_listado to authenticated, service_role;

-- ───────────────────────── Operaciones ─────────────────────────
-- Nota nueva en borrador, con el siguiente número de sesión de la historia.
create or replace function public.crear_nota(p_paciente uuid, p_fecha date)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id        uuid;
  v_modalidad public.modalidad;
begin
  perform 1 from public.historias where paciente_id = p_paciente for update;
  if not found then
    raise exception 'Ese paciente todavía no tiene historia clínica.';
  end if;
  select modalidad into v_modalidad from public.pacientes where id = p_paciente;

  insert into public.historia_notas (paciente_id, numero, fecha, duracion_min, modalidad, creada_por)
  select p_paciente, coalesce(max(numero), 0) + 1, p_fecha, 60, v_modalidad, (select auth.uid())
    from public.historia_notas
   where paciente_id = p_paciente
  returning id into v_id;
  return v_id;
end;
$$;

-- Firma una nota. Con `p_pago`, además deja registrada la sesión en la ficha
-- del paciente (asistencia y cobro), para no escribirla dos veces.
create or replace function public.firmar_nota(p_nota uuid, p_pago public.sesion_pago default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_nota   public.historia_notas;
  v_sesion uuid;
begin
  select * into v_nota from public.historia_notas where id = p_nota for update;
  if not found then
    raise exception 'La nota no existe.';
  end if;
  if v_nota.estado = 'firmada' then
    raise exception 'La nota ya está firmada.';
  end if;
  if p_pago is not null and v_nota.sesion_id is null then
    if v_nota.fecha is null then
      raise exception 'La nota necesita la fecha de la sesión para firmarse.';
    end if;
    v_sesion := public.registrar_sesion(v_nota.paciente_id, v_nota.fecha, 'realizada', p_pago, null);
  end if;
  update public.historia_notas
     set estado = 'firmada', sesion_id = coalesce(v_sesion, sesion_id)
   where id = p_nota;
end;
$$;

-- Cierra la revisión de una historia importada: sus notas quedan firmadas.
create or replace function public.confirmar_importacion(p_paciente uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.historias
     set revisada_el = now()
   where paciente_id = p_paciente and origen = 'word' and revisada_el is null;
  if not found then
    raise exception 'Esa historia no está pendiente de revisión.';
  end if;
  update public.historia_notas
     set estado = 'firmada'
   where paciente_id = p_paciente and origen = 'word' and estado = 'borrador';
end;
$$;

-- Deja constancia de una exportación a PDF.
create or replace function public.registrar_exportacion(p_paciente uuid, p_detalle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_staff() then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;
  perform private.historia_anotar(p_paciente, 'exportada', 'exportó ' || btrim(p_detalle) || ' en PDF.');
end;
$$;

revoke all on function public.crear_nota(uuid, date) from public, anon;
revoke all on function public.firmar_nota(uuid, public.sesion_pago) from public, anon;
revoke all on function public.confirmar_importacion(uuid) from public, anon;
revoke all on function public.registrar_exportacion(uuid, text) from public, anon;
grant execute on function public.crear_nota(uuid, date) to authenticated;
grant execute on function public.firmar_nota(uuid, public.sesion_pago) to authenticated;
grant execute on function public.confirmar_importacion(uuid) to authenticated;
grant execute on function public.registrar_exportacion(uuid, text) to authenticated;

-- ───────────────────────── Depósito de adjuntos ─────────────────────────
-- Privado: los archivos solo salen por la app, con enlaces que caducan. No hay
-- política de actualizar ni de borrar. (El bloque se salta donde no existe
-- Supabase Storage, como en las pruebas.)
do $$
begin
  if exists (
    select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('historias', 'historias', false, 10485760)
    on conflict (id) do nothing;

    execute $p$
      create policy historias_adjuntos_leer on storage.objects
        for select to authenticated
        using (bucket_id = 'historias' and (select private.es_staff()))
    $p$;
    execute $p$
      create policy historias_adjuntos_subir on storage.objects
        for insert to authenticated
        with check (bucket_id = 'historias' and (select private.es_staff()))
    $p$;
  end if;
end;
$$;
