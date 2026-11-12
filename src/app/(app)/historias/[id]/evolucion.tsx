"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, NotebookPen, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { HistoriaAdenda, HistoriaNota } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import { formatearFechaHora } from "@/lib/historias";
import { camposEscritos, textoDeNota } from "@/lib/historias/formatos";
import { MODALIDAD_LABEL } from "@/lib/pacientes";
import { normalizarBusqueda } from "@/lib/pacientes-filtros";
import { agregarAdenda, type HistoriaState } from "../actions";

/** Cuántas notas se ven antes de «ver anteriores». */
const RECIENTES = 10;

function AgregarAdenda({ nota, pacienteId }: { nota: HistoriaNota; pacienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pendiente] = useActionState(async (_prev: HistoriaState, fd: FormData) => {
    const r = await agregarAdenda(fd);
    if (r?.ok) setAbierto(false);
    return r;
  }, undefined);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Agregar adenda</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adenda a la sesión {nota.numero}</DialogTitle>
          <DialogDescription>
            La nota firmada no cambia: la adenda queda debajo, con la fecha y la hora de hoy. No se puede editar ni borrar después.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="nota_id" value={nota.id} />
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <label htmlFor={`adenda-${nota.id}`} className="text-sm font-medium">Qué se aclara o se corrige</label>
            <textarea id={`adenda-${nota.id}`} name="texto" rows={5} required className="control" />
          </div>
          {state?.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar adenda"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Línea de tiempo de las notas de sesión, de la más reciente a la más antigua. */
export function Evolucion({
  pacienteId, notas, adendas, objetivos, enRevision,
}: {
  pacienteId: string;
  notas: HistoriaNota[];
  adendas: HistoriaAdenda[];
  /** id → nombre del objetivo del plan de trabajo. */
  objetivos: Record<string, string>;
  /** La historia viene de Word y aún no se confirma: sus notas se corrigen en la revisión. */
  enRevision: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("");
  const [anio, setAnio] = useState("");
  const [todas, setTodas] = useState(false);

  const anios = useMemo(
    () => [...new Set(notas.map((n) => n.fecha?.slice(0, 4)).filter((a): a is string => Boolean(a)))].sort().reverse(),
    [notas],
  );
  const porNota = useMemo(() => {
    const m = new Map<string, HistoriaAdenda[]>();
    for (const a of adendas) m.set(a.nota_id, [...(m.get(a.nota_id) ?? []), a]);
    return m;
  }, [adendas]);

  const q = normalizarBusqueda(texto);
  const filtradas = notas.filter((n) =>
    (!estado || n.estado === estado) &&
    (!anio || n.fecha?.startsWith(anio)) &&
    (!q || normalizarBusqueda(`${textoDeNota(n)} ${(porNota.get(n.id) ?? []).map((a) => a.texto).join(" ")}`).includes(q)),
  );
  const filtrando = Boolean(q || estado || anio);
  const visibles = todas || filtrando ? filtradas : filtradas.slice(0, RECIENTES);

  if (notas.length === 0) {
    return (
      <div className="panel">
        <EmptyState
          icon={NotebookPen} title="Todavía no hay notas de sesión"
          description="Cada sesión queda como una nota: se escribe, se firma y pasa a formar parte de la historia."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-[1_1_16rem]">
          <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3.5 size-4" />
          <Input
            type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar en las notas de sesión" aria-label="Buscar en las notas" className="pl-10"
          />
        </div>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado de la nota" className="control sm:w-44">
          <option value="">Todas las notas</option>
          <option value="firmada">Firmadas</option>
          <option value="borrador">Borradores</option>
        </select>
        {anios.length > 1 && (
          <select value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año" className="control sm:w-32">
            <option value="">Todos los años</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {filtrando && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {filtradas.length} de {notas.length} notas
        </p>
      )}

      {visibles.map((n) => {
        const firmada = n.estado === "firmada";
        const importada = n.origen === "word";
        const campos = camposEscritos(n);
        const lasAdendas = porNota.get(n.id) ?? [];
        const trabajados = n.objetivos.map((id) => objetivos[id]).filter(Boolean);
        return (
          <article key={n.id} id={`nota-${n.numero}`} className="panel scroll-mt-6">
            <header className="border-border flex flex-wrap items-center justify-between gap-2.5 border-b px-5 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h2 className="text-base font-semibold">Sesión {n.numero}</h2>
                <span className="text-secondary-foreground">
                  {n.fecha ? formatearFecha(n.fecha) : (n.fecha_texto ?? "Sin fecha")}
                </span>
                <span className="text-muted-foreground text-[0.8125rem]">
                  {[n.duracion_min && `${n.duracion_min} min`, n.modalidad && MODALIDAD_LABEL[n.modalidad]].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {importada && <Badge variant="secondary">Importada de Word</Badge>}
                {firmada
                  ? <Badge variant="success"><Lock /> Firmada</Badge>
                  : <Badge variant="warning">{importada && enRevision ? "Por confirmar" : "Borrador"}</Badge>}
              </div>
            </header>

            {campos.length > 0 ? (
              <dl className="grid gap-x-5 gap-y-2.5 px-5 py-4 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
                {campos.map((c) => (
                  <div key={c.clave} className="contents">
                    <dt className="text-muted-foreground text-[0.8125rem] sm:pt-0.5">{c.label}</dt>
                    <dd className="text-secondary-foreground max-w-[70ch] leading-relaxed whitespace-pre-line">{c.texto}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground px-5 py-4">Sin texto todavía.</p>
            )}

            {trabajados.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-5 pb-4">
                <span className="text-muted-foreground mr-1 text-[0.8125rem]">Se trabajó:</span>
                {trabajados.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            )}

            {lasAdendas.map((a) => (
              <div key={a.id} className="bg-muted mx-5 mb-4 space-y-1 rounded-lg px-4 py-3">
                <p className="text-[0.8125rem] font-semibold">
                  Adenda · {formatearFechaHora(a.created_at)} · {a.autor_nombre ?? "Equipo"}
                </p>
                <p className="text-secondary-foreground leading-relaxed whitespace-pre-line">{a.texto}</p>
              </div>
            ))}

            <footer className="border-border flex flex-wrap items-center justify-between gap-2.5 border-t px-5 py-2.5">
              <p className="text-muted-foreground text-[0.8125rem]">
                {firmada
                  ? `Firmada por ${n.firmada_nombre ?? "el equipo"} · ${formatearFechaHora(n.firmada_el)}`
                  : importada && enRevision
                    ? "Quedará firmada cuando se confirme la revisión de la historia."
                    : `Borrador · guardado el ${formatearFechaHora(n.updated_at)}`}
              </p>
              {firmada ? (
                <AgregarAdenda nota={n} pacienteId={pacienteId} />
              ) : importada && enRevision ? (
                <Link href={`/historias/importar/${pacienteId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Ir a la revisión
                </Link>
              ) : (
                <Link href={`/historias/${pacienteId}/notas/${n.id}`} className={buttonVariants({ size: "sm" })}>
                  Continuar y firmar
                </Link>
              )}
            </footer>
          </article>
        );
      })}

      {filtradas.length === 0 && (
        <p className="panel text-muted-foreground px-5 py-5 text-sm">Ninguna nota coincide con la búsqueda.</p>
      )}

      {!todas && !filtrando && filtradas.length > RECIENTES && (
        <div className="flex justify-center">
          <Button type="button" variant="link" onClick={() => setTodas(true)}>
            Ver las {filtradas.length - RECIENTES} notas anteriores
          </Button>
        </div>
      )}
    </div>
  );
}
