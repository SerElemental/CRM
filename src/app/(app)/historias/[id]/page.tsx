import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FileText, Paperclip, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Estado } from "@/components/ui/estado";
import { Iniciales } from "@/components/ui/iniciales";
import { Resumen } from "@/components/ui/resumen";
import type { Historia, HistoriaNota } from "@/lib/database.types";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import {
  IDENTIFICACION, SECCIONES, formatearFechaHora, numeroHistoria, rangosDeSesiones, textoEdad,
} from "@/lib/historias";
import { ESTADO_LABEL, ESTADO_TONO } from "@/lib/pacientes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { abrirHistoria, crearNota } from "../actions";
import { SubirAdjunto } from "./adjuntos";
import { BloqueEditable } from "./bloque-editable";
import { Evolucion } from "./evolucion";
import { ExportarHistoria } from "./exportar";
import { EditarIdentificacion } from "./identificacion";
import { PlanDeTrabajo } from "./plan";

export const metadata: Metadata = { title: "Historia clínica" };

const VISTAS = ["valoracion", "evolucion", "plan", "adjuntos", "historial"] as const;
type Vista = (typeof VISTAS)[number];

const tamano = (bytes: number | null) =>
  bytes == null ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const TIPO_ADJUNTO: Record<string, string> = {
  "application/pdf": "PDF", "image/png": "Imagen", "image/jpeg": "Imagen", "image/webp": "Imagen",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
};

export default async function HistoriaPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const pedida = Array.isArray(sp.vista) ? sp.vista[0] : sp.vista;
  const vista: Vista = VISTAS.includes(pedida as Vista) ? (pedida as Vista) : "valoracion";

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("pacientes")
    .select("id, nombre_completo, documento, telefono, email, estado")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const { data: h } = await supabase.from("historias").select("*").eq("paciente_id", id).maybeSingle();

  if (!h) {
    return (
      <div className="space-y-6">
        <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
          <Link href="/historias" className="enlace">Historias clínicas</Link>
          <span aria-hidden>/</span>
          <span className="truncate">{p.nombre_completo}</span>
        </nav>
        <div className="panel">
          <EmptyState
            icon={ClipboardList}
            title={`${p.nombre_completo} todavía no tiene historia clínica`}
            description="Al abrirla queda en blanco, lista para diligenciar la valoración inicial y registrar las sesiones."
            action={
              <form action={abrirHistoria.bind(null, id)}>
                <Button type="submit"><Plus strokeWidth={2.2} /> Abrir historia</Button>
              </form>
            }
          />
        </div>
      </div>
    );
  }

  const [{ data: notasCrudas }, { data: objetivos }, { data: adjuntos }, { data: cambios }] = await Promise.all([
    supabase.from("historia_notas").select("*").eq("paciente_id", id).order("numero", { ascending: false }),
    supabase.from("historia_objetivos").select("*").eq("paciente_id", id).order("orden").order("created_at"),
    supabase.from("historia_adjuntos").select("*").eq("paciente_id", id).order("created_at"),
    vista === "historial"
      ? supabase.from("historia_cambios").select("*").eq("paciente_id", id).order("id", { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
  ]);

  const notas = (notasCrudas ?? []) as HistoriaNota[];
  // Solo las notas firmadas pueden tener adendas.
  const conAdendas = notas.filter((n) => n.estado === "firmada").map((n) => n.id);
  const { data: adendas } = vista === "evolucion" && conAdendas.length > 0
    ? await supabase.from("historia_adendas").select("*").in("nota_id", conAdendas).order("created_at")
    : { data: [] };
  const enRevision = h.origen === "word" && !h.revisada_el;
  const firmadas = notas.filter((n) => n.estado === "firmada").length;
  const borradores = notas.filter((n) => n.estado === "borrador" && !(enRevision && n.origen === "word"));
  const losObjetivos = objetivos ?? [];
  const trabajados = losObjetivos.filter((o) => o.estado === "trabajado").length;
  const proxima = notas.map((n) => n.campos?.proxima?.trim()).find(Boolean);
  const edad = textoEdad(h);
  const fechas = notas.map((n) => n.fecha).filter((f): f is string => Boolean(f)).sort();
  const vacias = SECCIONES.filter((s) => !h[s.campo]?.trim()).length;

  const sesionesPorObjetivo: Record<string, string> = {};
  for (const o of losObjetivos) {
    const texto = rangosDeSesiones(notas.filter((n) => n.objetivos.includes(o.id)).map((n) => n.numero));
    if (texto) sesionesPorObjetivo[o.id] = texto;
  }

  const pestanas: { vista: Vista; nombre: string; cuenta?: string }[] = [
    { vista: "valoracion", nombre: "Valoración inicial", cuenta: vacias > 0 ? `faltan ${vacias}` : undefined },
    { vista: "evolucion", nombre: "Evolución", cuenta: String(notas.length) },
    { vista: "plan", nombre: "Plan de trabajo", cuenta: losObjetivos.length ? `${trabajados} de ${losObjetivos.length}` : undefined },
    { vista: "adjuntos", nombre: "Adjuntos", cuenta: (adjuntos ?? []).length ? String((adjuntos ?? []).length) : undefined },
    { vista: "historial", nombre: "Historial" },
  ];

  const identidad: { k: string; v: string | null }[] = [
    { k: "Nombre", v: p.nombre_completo },
    { k: "Documento", v: p.documento },
    { k: "Edad", v: edad },
    { k: "Teléfono", v: p.telefono },
    { k: "Correo", v: p.email },
    ...IDENTIFICACION.map((c) => {
      const valor = h[c.campo] as string | null;
      if (c.campo === "fecha_consulta") return { k: c.label, v: valor ? formatearFecha(valor) : h.fecha_consulta_texto };
      return { k: c.label, v: c.tipo === "date" && valor ? formatearFecha(valor) : valor };
    }),
  ];
  const genogramas = (adjuntos ?? []).filter((a) => /genograma/i.test(a.nombre) && a.tipo?.startsWith("image/"));

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        <Link href="/historias" className="enlace">Historias clínicas</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{p.nombre_completo}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Iniciales nombre={p.nombre_completo} className="bg-brand text-brand-foreground size-13 text-lg md:size-15 md:text-xl" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="titulo">{p.nombre_completo}</h1>
            <div className="text-secondary-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm">
              <span className="font-mono text-[0.8125rem]">{numeroHistoria(h.numero)}</span>
              {p.documento && <span>{p.documento}</span>}
              {edad && <span>{edad}</span>}
              <Estado tono={ESTADO_TONO[p.estado]} className="text-foreground font-medium">{ESTADO_LABEL[p.estado]}</Estado>
              <span>Atiende: {h.profesional}</span>
              <Link href={`/pacientes/${id}`} className="enlace">Ver ficha</Link>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto">
          <ExportarHistoria
            pacienteId={id} archivo={`${numeroHistoria(h.numero)} ${p.nombre_completo}`}
            firmadas={firmadas} borradores={borradores.length} hoy={hoyBogota()} primeraFecha={fechas[0] ?? null}
          />
          <form action={crearNota.bind(null, id)} className="contents">
            <Button type="submit" disabled={enRevision} title={enRevision ? "Primero confirma la revisión de la importación" : undefined}>
              <Plus strokeWidth={2.2} /> Nueva nota de sesión
            </Button>
          </form>
        </div>
      </header>

      {enRevision && (
        <div className="border-warning/50 bg-warning-soft/60 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3.5">
          <div>
            <p className="font-semibold">Esta historia viene de Word y falta revisarla</p>
            <p className="text-secondary-foreground text-[0.84rem]">
              Compárala con el archivo original y confirma. Hasta entonces sus sesiones no quedan firmadas ni se pueden agregar notas nuevas.
            </p>
          </div>
          <Link href={`/historias/importar/${id}`} className={buttonVariants({ variant: "outline" })}>Revisar la importación</Link>
        </div>
      )}
      {sp.error === "nota" && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          No se pudo crear la nota. Intenta de nuevo.
        </p>
      )}

      <Resumen
        aria-label="Resumen de la historia"
        className="grid-cols-2 lg:grid-cols-4"
        datos={[
          {
            titulo: "Apertura",
            valor: h.fecha_consulta ? formatearFecha(h.fecha_consulta) : formatearFecha(h.created_at),
            detalle: h.fecha_consulta ? "primera consulta" : "historia abierta en el CRM",
          },
          { titulo: "Sesiones", valor: notas.length, detalle: `${firmadas} ${firmadas === 1 ? "nota firmada" : "notas firmadas"}` },
          {
            titulo: "Por firmar", valor: borradores.length, detalle: borradores.length === 1 ? "nota en borrador" : "notas en borrador",
            tono: borradores.length > 0 ? "text-warning-foreground" : undefined,
          },
          {
            titulo: "Plan de trabajo",
            valor: losObjetivos.length ? `${trabajados} de ${losObjetivos.length}` : "—",
            detalle: losObjetivos.length ? "objetivos trabajados" : "sin objetivos todavía",
          },
        ]}
      />
      {proxima && (
        <p className="panel text-secondary-foreground px-5 py-3 text-[0.84rem]">
          <span className="rotulo mr-2.5">Próxima sesión</span>
          <span className="whitespace-pre-line">{proxima}</span>
        </p>
      )}

      <nav aria-label="Partes de la historia" className="border-border -mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        {pestanas.map((t) => (
          <Link
            key={t.vista}
            href={t.vista === "valoracion" ? `/historias/${id}` : `/historias/${id}?vista=${t.vista}`}
            aria-current={vista === t.vista ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[0.9rem] whitespace-nowrap",
              vista === t.vista
                ? "border-foreground text-foreground font-semibold"
                : "text-secondary-foreground hover:text-foreground border-transparent font-medium",
            )}
          >
            {t.nombre}
            {t.cuenta && <span className="text-muted-foreground text-[0.8125rem] font-normal">{t.cuenta}</span>}
          </Link>
        ))}
      </nav>

      {vista === "valoracion" && (
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
          <aside aria-label="Índice de la valoración" className="hidden w-52 shrink-0 lg:sticky lg:top-10 lg:block">
            <p className="rotulo px-2.5 pb-2">Secciones</p>
            <ul className="space-y-0.5">
              {[{ href: "#identificacion", texto: "Datos de identificación", lleno: true }]
                .concat(SECCIONES.map((s) => ({ href: `#seccion-${s.n}`, texto: `${s.n}. ${s.corto}`, lleno: Boolean(h[s.campo]?.trim()) })))
                .map((i) => (
                  <li key={i.href}>
                    <a href={i.href} className="hover:bg-muted flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1 text-[0.84rem]">
                      <Estado tono={i.lleno ? "success" : "outline"}>
                        <span className="whitespace-normal">{i.texto}</span>
                        <span className="sr-only">{i.lleno ? " (diligenciada)" : " (falta)"}</span>
                      </Estado>
                    </a>
                  </li>
                ))}
            </ul>
            <p className="text-muted-foreground px-2.5 pt-3 text-xs">Punto relleno: diligenciada. Punto vacío: falta.</p>
          </aside>

          <div className="min-w-0 flex-1 space-y-4">
            <section id="identificacion" className="panel scroll-mt-6" aria-labelledby="identificacion-titulo">
              <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
                <h2 id="identificacion-titulo" className="text-base font-semibold">Datos de identificación</h2>
                <EditarIdentificacion historia={h as Historia} documento={p.documento} hoy={hoyBogota()} />
              </div>
              <dl className="grid gap-x-7 gap-y-3 px-5 py-4 text-[0.84rem] sm:grid-cols-2 xl:grid-cols-3">
                {identidad.map((d) => (
                  <div key={d.k}>
                    <dt className="text-muted-foreground text-[0.8125rem]">{d.k}</dt>
                    <dd className={cn("break-words", !d.v && "text-muted-foreground")}>{d.v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {SECCIONES.map((s) => (
              <section key={s.campo} id={`seccion-${s.n}`} className="panel scroll-mt-6 space-y-4 px-5 py-4">
                <BloqueEditable pacienteId={id} campo={s.campo} titulo={s.titulo} numero={s.n} inicial={h[s.campo]} />
                {s.subs?.map((b) => (
                  <div key={b.campo} className="border-border border-t pt-4">
                    <BloqueEditable pacienteId={id} campo={b.campo} titulo={b.titulo} nivel={3} filas={3} inicial={h[b.campo]} />
                  </div>
                ))}
                {s.genograma && (
                  <div className="border-border space-y-3 border-t pt-4">
                    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[0.84rem] font-semibold">Genograma familiar</h3>
                      <SubirAdjunto pacienteId={id} sugerido="Genograma familiar" />
                    </div>
                    {genogramas.length > 0 ? (
                      genogramas.map((g) => (
                        // eslint-disable-next-line @next/next/no-img-element -- archivo privado: sale por una ruta con enlace que caduca
                        <img key={g.id} src={`/historias/${id}/adjuntos/${g.id}`} alt="Genograma familiar del paciente" className="border-border max-h-[32rem] rounded-lg border" />
                      ))
                    ) : (
                      <p className="text-muted-foreground">Sin genograma. Se sube como imagen y queda aquí, dentro de la historia.</p>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {vista === "evolucion" && (
        <Evolucion
          pacienteId={id} notas={notas} adendas={adendas ?? []} enRevision={enRevision}
          objetivos={Object.fromEntries(losObjetivos.map((o) => [o.id, o.nombre]))}
        />
      )}

      {vista === "plan" && (
        <div className="space-y-4">
          <section className="panel px-5 py-4">
            <BloqueEditable pacienteId={id} campo="concepto_general" titulo="Concepto general" inicial={h.concepto_general} />
          </section>
          <PlanDeTrabajo pacienteId={id} objetivos={losObjetivos} sesiones={sesionesPorObjetivo} />
          <section className="panel px-5 py-4">
            <BloqueEditable
              pacienteId={id} campo="herramientas_apoyo" titulo="Herramientas de apoyo" filas={3} inicial={h.herramientas_apoyo}
              vacio="Sin registrar. Aquí van los libros, guías o videos que acompañan el proceso."
            />
          </section>
        </div>
      )}

      {vista === "adjuntos" && (
        <section className="panel" aria-labelledby="adjuntos-titulo">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <h2 id="adjuntos-titulo" className="text-base font-semibold">Adjuntos de la historia</h2>
            <SubirAdjunto pacienteId={id} />
          </div>
          {(adjuntos ?? []).length === 0 ? (
            <div className="border-border border-t">
              <EmptyState icon={Paperclip} title="Sin adjuntos" description="Genograma, consentimiento informado firmado, resultados de pruebas." />
            </div>
          ) : (
            <ul>
              {(adjuntos ?? []).map((a) => (
                <li key={a.id} className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-5 py-3">
                  <a href={`/historias/${id}/adjuntos/${a.id}`} target="_blank" rel="noreferrer" className="enlace inline-flex min-h-9 items-center gap-2.5">
                    <FileText className="size-4 shrink-0" /> {a.nombre}
                  </a>
                  <span className="text-muted-foreground text-[0.8125rem]">
                    {[TIPO_ADJUNTO[a.tipo ?? ""] ?? "Archivo", tamano(a.tamano), `subido el ${formatearFecha(a.created_at)}`].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {vista === "historial" && (
        <section className="panel" aria-labelledby="historial-titulo">
          <div className="px-5 py-3.5">
            <h2 id="historial-titulo" className="text-base font-semibold">Historial de cambios</h2>
            <p className="text-muted-foreground text-[0.8125rem]">Registro automático. No se puede editar ni borrar.</p>
          </div>
          <ol>
            {(cambios ?? []).map((c) => (
              <li key={c.id} className="border-border grid gap-x-4 gap-y-1 border-t px-5 py-3 sm:grid-cols-[12.5rem_minmax(0,1fr)]">
                <span className="text-muted-foreground font-mono text-[0.78rem] sm:pt-0.5">{formatearFechaHora(c.cuando)}</span>
                <div className="space-y-1.5">
                  <p><span className="font-medium">{c.usuario_nombre}</span> {c.detalle}</p>
                  {c.accion === "seccion" && c.anterior?.trim() && (
                    <details className="text-[0.84rem]">
                      <summary className="enlace cursor-pointer">Ver el texto anterior</summary>
                      <p className="bg-muted text-secondary-foreground mt-1.5 max-w-[72ch] rounded-lg px-3.5 py-2.5 whitespace-pre-line">{c.anterior}</p>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
