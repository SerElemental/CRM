import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { HistoriaNota } from "@/lib/database.types";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import { SECCIONES, leerAvisos, numeroHistoria } from "@/lib/historias";
import type { ParrafoOrigen } from "@/lib/importacion/historia-word";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Revision } from "./revision";

export const metadata: Metadata = { title: "Revisar importación" };

const esParrafo = (x: unknown): x is ParrafoOrigen =>
  typeof x === "object" && x !== null && typeof (x as ParrafoOrigen).t === "string";

export default async function RevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: h }, { data: p }] = await Promise.all([
    supabase.from("historias").select("*").eq("paciente_id", id).maybeSingle(),
    supabase.from("pacientes_listado").select("id, nombre_completo, documento, sesiones_total").eq("id", id).maybeSingle(),
  ]);
  if (!h || !p) notFound();
  // Solo se revisa lo importado que sigue pendiente.
  if (h.origen !== "word" || h.revisada_el) redirect(`/historias/${id}`);

  const [{ data: notas }, { data: objetivos }, { data: importadas }] = await Promise.all([
    supabase.from("historia_notas").select("*").eq("paciente_id", id).order("numero"),
    supabase.from("historia_objetivos").select("nombre").eq("paciente_id", id).order("orden"),
    supabase.from("historias_listado").select("paciente_id, estado").eq("origen", "word").order("nombre_completo"),
  ]);
  const todas = importadas ?? [];
  const pendientes = todas.filter((x) => x.estado === "por_revisar").map((x) => x.paciente_id);
  const posicion = pendientes.indexOf(id);
  const anterior = posicion > 0 ? pendientes[posicion - 1] : null;
  const siguiente = posicion >= 0 && posicion < pendientes.length - 1 ? pendientes[posicion + 1] : null;
  const revisadas = todas.length - pendientes.length;

  const origen = Array.isArray(h.texto_origen) ? h.texto_origen.filter(esParrafo) : [];
  const avisos = leerAvisos(h.avisos);
  const secciones = [
    ...SECCIONES.map((s) => ({ nombre: `${s.n}. ${s.corto}`, lleno: Boolean(h[s.campo]?.trim()) })),
    { nombre: "Concepto general", lleno: Boolean(h.concepto_general?.trim()) },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-muted-foreground flex flex-wrap items-center gap-2 text-[0.8125rem]">
        <Link href="/historias" className="enlace">Historias clínicas</Link>
        <span aria-hidden>/</span>
        <Link href="/historias/importar" className="enlace">Importación desde Word</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{p.nombre_completo}</span>
      </nav>

      <header className="space-y-1.5">
        <h1 className="titulo">{p.nombre_completo}</h1>
        <div className="text-secondary-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm">
          <span className="font-mono text-[0.8125rem]">{numeroHistoria(h.numero)}</span>
          <span className="font-mono text-[0.8125rem]">{h.archivo_origen}</span>
          <span>Pendiente {posicion + 1} de {pendientes.length}</span>
          {avisos.length > 0 && <Badge variant="warning">{avisos.length} {avisos.length === 1 ? "aviso" : "avisos"}</Badge>}
        </div>
      </header>

      <div className="space-y-1.5">
        <div
          role="progressbar" aria-label="Historias revisadas" aria-valuemin={0} aria-valuemax={todas.length} aria-valuenow={revisadas}
          className="bg-border h-1.5 overflow-hidden rounded-full"
        >
          <div className="bg-success h-full" style={{ width: `${todas.length ? (revisadas / todas.length) * 100 : 0}%` }} />
        </div>
        <p className="text-muted-foreground text-[0.8125rem]">{revisadas} de {todas.length} revisadas</p>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <section aria-labelledby="original-titulo" className="min-w-0 space-y-2.5 xl:sticky xl:top-10 xl:w-[26rem] xl:shrink-0">
          <h2 id="original-titulo" className="rotulo">Archivo original de Word</h2>
          <div className="border-input bg-card max-h-[75vh] space-y-2 overflow-y-auto border px-6 py-5 font-serif text-[0.84rem] leading-relaxed" tabIndex={0}>
            {origen.length === 0 && <p className="text-muted-foreground font-sans">No se guardó el texto original de este archivo.</p>}
            {origen.map((o, i) => (
              <p key={i} className={cn("whitespace-pre-line", o.n && "pt-1.5 font-bold")}>{o.t}</p>
            ))}
          </div>
          <p className="text-muted-foreground text-[0.8125rem]">El archivo de Word también queda guardado en los adjuntos de la historia.</p>
        </section>

        <div className="min-w-0 flex-1 space-y-4">
          <h2 className="rotulo">Así queda en la historia</h2>

          <Revision
            pacienteId={id}
            documento={p.documento}
            fechaConsulta={h.fecha_consulta}
            fechaConsultaTexto={h.fecha_consulta_texto}
            hoy={hoyBogota()}
            avisos={avisos}
            notas={((notas ?? []) as HistoriaNota[]).map((n) => ({
              id: n.id, numero: n.numero, fecha: n.fecha, fechaTexto: n.fecha_texto, encabezado: n.encabezado_origen,
              vacia: !Object.values(n.campos ?? {}).some((t) => t.trim()),
            }))}
            sesionesFicha={p.sesiones_total}
            anterior={anterior}
            siguiente={siguiente}
          >
            <section className="panel" aria-label="Lo que se cargó">
              <dl className="divide-border divide-y text-[0.84rem]">
                <div className="grid gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">Paciente en el CRM</dt>
                  <dd><Link href={`/pacientes/${id}`} className="enlace">{p.nombre_completo}</Link></dd>
                </div>
                <div className="grid gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">Identificación</dt>
                  <dd className="text-secondary-foreground">
                    {[h.edad_texto, h.estado_civil, h.ocupacion, h.escolaridad].filter(Boolean).join(" · ") || "Sin datos en el Word"}
                    {h.fecha_consulta && ` · consulta del ${formatearFecha(h.fecha_consulta)}`}
                  </dd>
                </div>
                <div className="grid gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">Secciones</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {secciones.map((s) => (
                      <Badge key={s.nombre} variant={s.lleno ? "success" : "outline"}>
                        {s.nombre}{s.lleno ? "" : " · vacía"}
                      </Badge>
                    ))}
                  </dd>
                </div>
                <div className="grid gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">Plan de trabajo</dt>
                  <dd className="text-secondary-foreground">
                    {(objetivos ?? []).length === 0
                      ? "Sin objetivos en el Word"
                      : `${(objetivos ?? []).length} objetivos: ${(objetivos ?? []).map((o) => o.nombre).join(" · ")}`}
                  </dd>
                </div>
              </dl>
              <div className="border-border flex flex-wrap items-center justify-between gap-2.5 border-t px-5 py-3">
                <p className="text-muted-foreground text-[0.8125rem]">¿Algún texto quedó en la sección equivocada? Se corrige en la historia.</p>
                <Link href={`/historias/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Abrir la historia</Link>
              </div>
            </section>
          </Revision>
        </div>
      </div>
    </div>
  );
}
