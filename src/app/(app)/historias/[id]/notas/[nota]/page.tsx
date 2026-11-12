import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Estado } from "@/components/ui/estado";
import type { HistoriaNota } from "@/lib/database.types";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import { OBJETIVO_LABEL, OBJETIVO_TONO, numeroHistoria } from "@/lib/historias";
import { camposEscritos } from "@/lib/historias/formatos";
import { createClient } from "@/lib/supabase/server";
import { EditorNota } from "./editor-nota";

export const metadata: Metadata = { title: "Nota de sesión" };

export default async function NotaPage({ params }: { params: Promise<{ id: string; nota: string }> }) {
  const { id, nota: notaId } = await params;
  const supabase = await createClient();

  const [{ data: nota }, { data: p }, { data: h }] = await Promise.all([
    supabase.from("historia_notas").select("*").eq("id", notaId).eq("paciente_id", id).maybeSingle(),
    supabase.from("pacientes_listado").select("id, nombre_completo, sesiones_prepagadas").eq("id", id).maybeSingle(),
    supabase.from("historias").select("numero, motivo_consulta, origen, revisada_el").eq("paciente_id", id).maybeSingle(),
  ]);
  if (!nota || !p || !h) notFound();
  // Una nota firmada ya no se edita: se ve en la evolución, donde admite adendas.
  if (nota.estado === "firmada") redirect(`/historias/${id}?vista=evolucion#nota-${nota.numero}`);
  // Las notas importadas se corrigen en la revisión de la importación.
  if (nota.origen === "word" && !h.revisada_el) redirect(`/historias/importar/${id}`);

  const [{ data: objetivos }, { data: anteriores }, { data: sesiones }, { data: enlazadas }] = await Promise.all([
    supabase.from("historia_objetivos").select("*").eq("paciente_id", id).order("orden").order("created_at"),
    supabase.from("historia_notas").select("*").eq("paciente_id", id).lt("numero", nota.numero)
      .order("numero", { ascending: false }).limit(1),
    supabase.from("sesiones").select("id, fecha").eq("paciente_id", id).eq("asistencia", "realizada").not("fecha", "is", null),
    supabase.from("historia_notas").select("sesion_id").eq("paciente_id", id).not("sesion_id", "is", null),
  ]);

  const anterior = (anteriores ?? [])[0] as HistoriaNota | undefined;
  const usadas = new Set((enlazadas ?? []).map((n) => n.sesion_id));
  // Fechas con una sesión ya registrada en la ficha y todavía sin nota: al firmar se enlaza en vez de duplicarla.
  const fechasLibres = [...new Set((sesiones ?? []).filter((s) => !usadas.has(s.id)).map((s) => s.fecha as string))];

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-muted-foreground flex flex-wrap items-center gap-2 text-[0.8125rem]">
        <Link href="/historias" className="enlace">Historias clínicas</Link>
        <span aria-hidden>/</span>
        <Link href={`/historias/${id}?vista=evolucion`} className="enlace">{p.nombre_completo}</Link>
        <span aria-hidden>/</span>
        <span>Sesión {nota.numero}</span>
      </nav>

      <EditorNota
        nota={nota as HistoriaNota}
        paciente={{ id, nombre: p.nombre_completo, historia: numeroHistoria(h.numero), prepagadas: p.sesiones_prepagadas }}
        objetivos={(objetivos ?? []).map((o) => ({ id: o.id, nombre: o.nombre }))}
        fechasLibres={fechasLibres}
        hoy={hoyBogota()}
      >
        {anterior && (
          <section className="panel space-y-2.5 px-5 py-4">
            <h2 className="rotulo">
              Sesión anterior · {anterior.numero}{anterior.fecha ? ` · ${formatearFecha(anterior.fecha)}` : ""}
            </h2>
            {camposEscritos(anterior).filter((c) => c.clave !== "desarrollo").map((c) => (
              <div key={c.clave}>
                <p className="text-muted-foreground text-[0.8125rem]">{c.clave === "proxima" ? "Se acordó para hoy" : c.clave === "tarea" ? "Quedó de tarea" : c.label}</p>
                <p className="text-secondary-foreground whitespace-pre-line">{c.texto}</p>
              </div>
            ))}
            <Link href={`/historias/${id}?vista=evolucion`} className="enlace inline-block text-[0.84rem]">Ver toda la evolución</Link>
          </section>
        )}
        {h.motivo_consulta?.trim() && (
          <section className="panel space-y-2 px-5 py-4">
            <h2 className="rotulo">Motivo de consulta</h2>
            <p className="text-secondary-foreground line-clamp-6 whitespace-pre-line">{h.motivo_consulta}</p>
          </section>
        )}
        {(objetivos ?? []).length > 0 && (
          <section className="panel space-y-2.5 px-5 py-4">
            <h2 className="rotulo">
              Plan de trabajo · {(objetivos ?? []).filter((o) => o.estado === "trabajado").length} de {(objetivos ?? []).length}
            </h2>
            <ul className="space-y-2 text-[0.84rem]">
              {(objetivos ?? []).map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3">
                  <Estado tono={OBJETIVO_TONO[o.estado]} className="items-start whitespace-normal [&>span:first-child]:mt-1.5">{o.nombre}</Estado>
                  <span className="text-muted-foreground shrink-0 text-[0.8125rem]">{OBJETIVO_LABEL[o.estado]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </EditorNota>
    </div>
  );
}
