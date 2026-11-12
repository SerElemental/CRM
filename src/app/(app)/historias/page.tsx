import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Estado } from "@/components/ui/estado";
import { Iniciales } from "@/components/ui/iniciales";
import { Resumen } from "@/components/ui/resumen";
import type { HistoriaEstado } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import { ESTADO_HISTORIA_LABEL, ESTADO_HISTORIA_TONO, numeroHistoria } from "@/lib/historias";
import { normalizarBusqueda } from "@/lib/pacientes-filtros";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AbrirHistoria } from "./abrir-historia";
import { FiltrosHistorias, type FiltrosHistoria } from "./filtros-historias";

export const metadata: Metadata = { title: "Historias clínicas" };

const ESTADOS: HistoriaEstado[] = ["completa", "incompleta", "por_revisar"];
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lo que le falta a una historia, en pocas palabras. */
function pendientes(h: { estado: HistoriaEstado; notas_borrador: number; secciones_vacias: number; avisos_total: number; documento: string | null }) {
  const p: string[] = [];
  if (h.notas_borrador > 0) p.push(`${h.notas_borrador} ${h.notas_borrador === 1 ? "nota por firmar" : "notas por firmar"}`);
  if (h.estado === "por_revisar") p.push(h.avisos_total > 0 ? `${h.avisos_total} ${h.avisos_total === 1 ? "dato por revisar" : "datos por revisar"}` : "Falta confirmar la importación");
  else if (h.secciones_vacias > 0) p.push(`${h.secciones_vacias} ${h.secciones_vacias === 1 ? "sección vacía" : "secciones vacías"}`);
  if (!h.documento) p.push("Falta el documento");
  return p;
}

export default async function HistoriasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtros: FiltrosHistoria = {
    q: uno(sp.q).trim().slice(0, 100),
    estado: ESTADOS.includes(uno(sp.estado) as HistoriaEstado) ? uno(sp.estado) : "",
    pendiente: ["firmar", "documento"].includes(uno(sp.pendiente)) ? uno(sp.pendiente) : "",
  };

  const supabase = await createClient();
  const cuenta = () => supabase.from("historias_listado").select("paciente_id", { count: "exact", head: true });

  let consulta = supabase
    .from("historias_listado")
    .select(
      "paciente_id, numero, nombre_completo, documento, notas_total, notas_borrador, ultima_nota, secciones_vacias, avisos_total, estado",
      { count: "exact" },
    );
  if (filtros.q) {
    const patron = normalizarBusqueda(filtros.q).replace(/[\\%_,()]/g, " ").trim();
    const digitos = filtros.q.replace(/\D/g, "");
    // El documento se guarda como se escribe («C.C. 1.234.567»): se busca tal cual y por el nombre.
    consulta = digitos.length >= 4
      ? consulta.or(`busqueda.ilike.%${patron}%,documento.ilike.%${filtros.q.replace(/[\\%_,()]/g, " ").trim()}%`)
      : consulta.ilike("busqueda", `%${patron}%`);
  }
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado as HistoriaEstado);
  if (filtros.pendiente === "firmar") consulta = consulta.gt("notas_borrador", 0);
  if (filtros.pendiente === "documento") consulta = consulta.is("documento", null);

  const [resultado, total, porRevisar, incompletas, conBorradores, sinDocumento, importadas] = await Promise.all([
    consulta.order("nombre_completo").range(0, 999),
    cuenta(),
    cuenta().eq("estado", "por_revisar"),
    cuenta().eq("estado", "incompleta"),
    supabase.from("historia_notas").select("id", { count: "exact", head: true }).eq("estado", "borrador").eq("origen", "crm"),
    cuenta().is("documento", null),
    cuenta().eq("origen", "word"),
  ]);

  const historias = resultado.data ?? [];
  const n = (r: { count: number | null }) => r.count ?? 0;
  const filtrado = Boolean(filtros.q || filtros.estado || filtros.pendiente);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="titulo">Historias clínicas</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {filtrado ? `${resultado.count ?? 0} de ${n(total)} historias` : "Una historia por paciente. Se abre, se edita y se firma aquí mismo."}
          </p>
        </div>
        <AbrirHistoria />
      </div>

      {n(porRevisar) > 0 && (
        <div className="border-warning/50 bg-warning-soft/60 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3.5">
          <div>
            <p className="font-semibold">
              Importación desde Word: {n(importadas) - n(porRevisar)} de {n(importadas)} historias revisadas
            </p>
            <p className="text-secondary-foreground text-[0.84rem]">
              {n(porRevisar) === 1 ? "La que falta ya está cargada" : `Las ${n(porRevisar)} que faltan ya están cargadas`}
              , pero hay que confirmar que cada dato quedó en su lugar.
            </p>
          </div>
          <Link href="/historias/importar" className={buttonVariants({ variant: "outline" })}>Continuar la revisión</Link>
        </div>
      )}

      <Resumen
        aria-label="Resumen de historias"
        className="grid-cols-2 lg:grid-cols-4"
        datos={[
          { titulo: "Historias", valor: n(total), detalle: "una por paciente" },
          {
            titulo: "Notas por firmar", valor: n(conBorradores), detalle: "borradores abiertos",
            tono: n(conBorradores) > 0 ? "text-warning-foreground" : undefined,
          },
          { titulo: "Incompletas", valor: n(incompletas), detalle: "con secciones vacías" },
          {
            titulo: "Sin documento", valor: n(sinDocumento), detalle: "dato de identificación pendiente",
            tono: n(sinDocumento) > 0 ? "text-warning-foreground" : undefined,
          },
        ]}
      />

      <FiltrosHistorias activos={filtros} />

      {resultado.error ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          No se pudieron cargar las historias. Recarga la página.
        </p>
      ) : historias.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={ClipboardList}
            title={filtrado ? "No hay historias con estos filtros" : "Aún no hay historias clínicas"}
            description={filtrado ? "Quita algún filtro o limpia la búsqueda." : "Abre la primera con el botón «Abrir historia»."}
          />
        </div>
      ) : (
        <>
          <div className="tabla-wrap hidden md:block">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Documento</th>
                  <th>Sesiones</th>
                  <th>Última nota</th>
                  <th>Historia</th>
                  <th>Pendientes</th>
                  <th className="w-20"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {historias.map((h) => {
                  const p = pendientes(h);
                  return (
                    <tr key={h.paciente_id} className="group">
                      <td>
                        <div className="flex items-center gap-3">
                          <Iniciales nombre={h.nombre_completo} />
                          <div className="min-w-0">
                            <Link href={`/historias/${h.paciente_id}`} className="font-medium hover:underline">{h.nombre_completo}</Link>
                            <p className="text-muted-foreground font-mono text-xs">{numeroHistoria(h.numero)}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("whitespace-nowrap", h.documento ? "text-secondary-foreground" : "text-warning-foreground font-medium")}>
                        {h.documento ?? "Sin documento"}
                      </td>
                      <td className="tabular-nums">{h.notas_total}</td>
                      <td className="text-secondary-foreground whitespace-nowrap">{formatearFecha(h.ultima_nota)}</td>
                      <td><Estado tono={ESTADO_HISTORIA_TONO[h.estado]}>{ESTADO_HISTORIA_LABEL[h.estado]}</Estado></td>
                      <td className={cn("text-[0.84rem]", p.length ? "text-warning-foreground" : "text-muted-foreground")}>
                        {p.length ? p.join(" · ") : "Al día"}
                      </td>
                      <td className="py-1.5! pl-0!">
                        <div className="flex items-center justify-end">
                          <a
                            href={`/historias/${h.paciente_id}/pdf?descargar=1`} title="Exportar PDF"
                            aria-label={`Exportar en PDF la historia de ${h.nombre_completo}`}
                            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                          >
                            <FileDown />
                          </a>
                          <Link
                            href={`/historias/${h.paciente_id}`} aria-label={`Abrir la historia de ${h.nombre_completo}`} tabIndex={-1}
                            className="text-muted-foreground group-hover:text-foreground flex size-8 items-center justify-center"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="panel divide-border divide-y overflow-hidden md:hidden">
            {historias.map((h) => {
              const p = pendientes(h);
              return (
                <li key={h.paciente_id}>
                  <Link href={`/historias/${h.paciente_id}`} className="active:bg-muted flex min-h-[4.25rem] items-center gap-3 px-4 py-2.5">
                    <Iniciales nombre={h.nombre_completo} className="size-10 text-[0.84rem]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.nombre_completo}</span>
                      <Estado tono={ESTADO_HISTORIA_TONO[h.estado]} className="text-secondary-foreground gap-1.5 text-[0.84rem]">
                        {ESTADO_HISTORIA_LABEL[h.estado]} · {h.notas_total} {h.notas_total === 1 ? "sesión" : "sesiones"}
                      </Estado>
                      {p.length > 0 && <span className="text-warning-foreground block truncate text-[0.8125rem]">{p.join(" · ")}</span>}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
