import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Estado } from "@/components/ui/estado";
import { formatearFecha } from "@/lib/fecha";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importación desde Word" };

export default async function ImportacionPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("historias_listado")
    .select("paciente_id, nombre_completo, archivo_origen, notas_total, avisos_total, estado, revisada_el")
    .eq("origen", "word")
    .order("nombre_completo");
  const historias = data ?? [];
  const pendientes = historias.filter((h) => h.estado === "por_revisar");
  const revisadas = historias.length - pendientes.length;

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        <Link href="/historias" className="enlace">Historias clínicas</Link>
        <span aria-hidden>/</span>
        <span>Importación desde Word</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="titulo">Importación desde Word</h1>
          <p className="text-muted-foreground max-w-[65ch] text-sm">
            Cada historia que venía en Word ya está cargada. Falta compararla con el archivo original y confirmarla:
            ahí sus sesiones quedan firmadas.
          </p>
        </div>
        {pendientes.length > 0 && (
          <Link href={`/historias/importar/${pendientes[0].paciente_id}`} className={buttonVariants()}>
            Revisar la siguiente
          </Link>
        )}
      </div>

      {historias.length === 0 ? (
        <div className="panel">
          <EmptyState icon={FileCheck2} title="No hay historias importadas" description="Cuando se carguen archivos de Word aparecerán aquí para revisarlos." />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <div
              role="progressbar" aria-label="Historias revisadas" aria-valuemin={0} aria-valuemax={historias.length} aria-valuenow={revisadas}
              className="bg-border h-1.5 overflow-hidden rounded-full"
            >
              <div className="bg-success h-full" style={{ width: `${(revisadas / historias.length) * 100}%` }} />
            </div>
            <p className="text-muted-foreground text-[0.8125rem]">
              {revisadas} de {historias.length} revisadas{pendientes.length > 0 ? ` · ${pendientes.length} por revisar` : ". Todo al día."}
            </p>
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Archivo</th>
                  <th>Sesiones</th>
                  <th>Estado</th>
                  <th className="w-28"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {historias.map((h) => {
                  const pendiente = h.estado === "por_revisar";
                  return (
                    <tr key={h.paciente_id}>
                      <td className="font-medium">{h.nombre_completo}</td>
                      <td className="text-secondary-foreground font-mono text-[0.78rem]">{h.archivo_origen ?? "—"}</td>
                      <td className="tabular-nums">{h.notas_total}</td>
                      <td>
                        {pendiente ? (
                          <Estado tono="warning">
                            Por revisar{h.avisos_total > 0 ? ` · ${h.avisos_total} ${h.avisos_total === 1 ? "aviso" : "avisos"}` : ""}
                          </Estado>
                        ) : (
                          <Estado tono="success">Revisada el {formatearFecha(h.revisada_el)}</Estado>
                        )}
                      </td>
                      <td className="py-1.5! text-right">
                        <Link
                          href={pendiente ? `/historias/importar/${h.paciente_id}` : `/historias/${h.paciente_id}`}
                          className={buttonVariants({ variant: pendiente ? "outline" : "ghost", size: "sm" })}
                        >
                          {pendiente ? "Revisar" : "Abrir"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
