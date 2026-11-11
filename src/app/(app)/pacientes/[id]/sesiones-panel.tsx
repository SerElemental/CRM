"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Estado } from "@/components/ui/estado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmentado } from "@/components/ui/segmentado";
import type { Sesion } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import { ASISTENCIA_LABEL, ESTADO_VISUAL, estadoVisual, type EstadoVisual } from "@/lib/sesiones";
import { cn } from "@/lib/utils";
import {
  cobrarSesion, editarSesion, eliminarSesion, registrarPaquete, registrarSesion, type SesionState,
} from "./sesion-actions";

/** Cuántas sesiones se ven en la tabla antes de «ver anteriores». */
const RECIENTES = 12;

/** Formulario dentro de un diálogo: lo cierra cuando la acción termina bien. */
function useAccion(accion: (fd: FormData) => Promise<SesionState>, alTerminar: () => void) {
  return useActionState(async (_prev: SesionState, fd: FormData) => {
    const r = await accion(fd);
    if (r?.ok) alTerminar();
    return r;
  }, undefined);
}

function ErrorForm({ state }: { state: SesionState }) {
  return state?.error ? (
    <p role="alert" className="text-destructive text-sm">{state.error}</p>
  ) : null;
}

/** La acción más frecuente del CRM: vive en el encabezado de la ficha. */
export function RegistrarSesion({
  pacienteId, nombre, hoy, prepagadas, className,
}: {
  pacienteId: string; nombre: string; hoy: string; prepagadas: number; className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [asistencia, setAsistencia] = useState("realizada");
  const [state, action, pendiente] = useAccion(registrarSesion, () => setAbierto(false));

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button className={className} />}>
        <Plus strokeWidth={2.2} /> Registrar sesión
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar sesión</DialogTitle>
          <DialogDescription>
            {nombre} ·{" "}
            {prepagadas > 0
              ? `se descuenta del paquete: quedan ${prepagadas} ${prepagadas === 1 ? "sesión prepagada" : "sesiones prepagadas"}.`
              : "queda como la siguiente sesión del proceso."}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <Label htmlFor="rs-fecha">Fecha</Label>
            <Input id="rs-fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label id="rs-asistencia">¿Qué pasó?</Label>
            <Segmentado
              name="asistencia" aria-labelledby="rs-asistencia" value={asistencia} onChange={setAsistencia}
              opciones={[
                { value: "realizada", label: "La sesión se realizó" },
                { value: "perdida", label: "No asistió" },
              ]}
            />
          </div>
          {prepagadas > 0 ? (
            <input type="hidden" name="pago" value="pagada" />
          ) : (
            <div className="space-y-1.5">
              <Label id="rs-pago">Pago</Label>
              {/* La `key` vuelve a montar el control al cambiar la asistencia: las opciones son otras. */}
              {asistencia === "realizada" ? (
                <Segmentado
                  key="realizada" name="pago" aria-labelledby="rs-pago" defaultValue="pagada"
                  opciones={[
                    { value: "pagada", label: "Pagada" },
                    { value: "sin_pagar", label: "Sin pagar" },
                  ]}
                />
              ) : (
                <Segmentado
                  key="perdida" name="pago" aria-labelledby="rs-pago" defaultValue="no_aplica"
                  opciones={[
                    { value: "no_aplica", label: "Sin cobro" },
                    { value: "sin_pagar", label: "Con multa por cobrar" },
                  ]}
                />
              )}
              <p className="text-muted-foreground text-[0.8125rem]">
                {asistencia === "realizada"
                  ? "«Sin pagar» la deja en por cobrar hasta que la cobres o la factures."
                  : "La multa queda en por cobrar, igual que una sesión sin pagar."}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rs-nota">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <textarea id="rs-nota" name="nota" rows={2} className="control" />
          </div>
          <ErrorForm state={state} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Registrar sesión"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrarPaquete({ pacienteId, className }: { pacienteId: string; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pendiente] = useAccion(registrarPaquete, () => setAbierto(false));

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" className={className} />}>
        Registrar paquete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar paquete</DialogTitle>
          <DialogDescription>
            Sesiones pagadas por adelantado. Quedan disponibles y se van descontando al registrar cada sesión.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <Label htmlFor="rp-cantidad">Número de sesiones</Label>
            <Input id="rp-cantidad" name="cantidad" type="number" min={1} max={50} defaultValue={4} required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-nota">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <textarea id="rp-nota" name="nota" rows={2} className="control" />
          </div>
          <ErrorForm state={state} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Registrar paquete"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarSesion({ sesion }: { sesion: Sesion }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [state, action, pendiente] = useAccion(editarSesion, () => setAbierto(false));
  const [borrado, borrar, borrando] = useActionState(async () => {
    const r = await eliminarSesion(sesion.paciente_id, sesion.id);
    if (r?.ok) setAbierto(false);
    return r;
  }, undefined);

  return (
    <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); setConfirmar(false); }}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Editar sesión ${sesion.numero}`} />}
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesión {sesion.numero}</DialogTitle>
          {sesion.origen === "excel" && <DialogDescription>Importada del Excel.</DialogDescription>}
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="id" value={sesion.id} />
          <input type="hidden" name="paciente_id" value={sesion.paciente_id} />
          <div className="space-y-1.5">
            <Label htmlFor={`es-fecha-${sesion.id}`}>Fecha</Label>
            <Input id={`es-fecha-${sesion.id}`} name="fecha" type="date" defaultValue={sesion.fecha ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label id={`es-asis-${sesion.id}`}>Asistencia</Label>
            <Segmentado
              name="asistencia" aria-labelledby={`es-asis-${sesion.id}`} defaultValue={sesion.asistencia}
              opciones={[
                { value: "realizada", label: "Realizada" },
                { value: "pendiente", label: "Pendiente" },
                { value: "perdida", label: "Perdida" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`es-pago-${sesion.id}`}>Pago</Label>
            <select id={`es-pago-${sesion.id}`} name="pago" className="control" defaultValue={sesion.pago}>
              <option value="pagada">Pagada</option>
              <option value="paquete">Paquete (por adelantado)</option>
              <option value="sin_pagar">Sin pagar</option>
              <option value="no_aplica">No aplica</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`es-nota-${sesion.id}`}>Nota</Label>
            <textarea id={`es-nota-${sesion.id}`} name="nota" rows={3} className="control" defaultValue={sesion.nota ?? ""} />
          </div>
          <ErrorForm state={state} />
          <ErrorForm state={borrado} />
          <DialogFooter className="sm:justify-between">
            {/* Las `key` son necesarias: sin ellas React reutiliza el mismo <button> al
                cambiar de uno a otro y el clic en «Eliminar» envía el borrado sin confirmar. */}
            {confirmar ? (
              <div key="confirmar" className="flex items-center gap-2">
                <Button type="submit" variant="destructive" formAction={borrar} disabled={borrando}>
                  {borrando ? "Eliminando…" : "Sí, eliminar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmar(false)}>No</Button>
              </div>
            ) : (
              <Button key="pedir" type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmar(true)}>
                Eliminar
              </Button>
            )}
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Pago({ sesion, pacienteId }: { sesion: Sesion; pacienteId: string }) {
  if (sesion.pago === "sin_pagar") {
    return (
      <form action={cobrarSesion.bind(null, pacienteId, sesion.id)} className="flex items-center gap-2.5">
        <Badge variant="warning">Sin pagar</Badge>
        <Button type="submit" variant="outline" size="xs">Cobrar</Button>
      </form>
    );
  }
  if (sesion.pago === "paquete") return <Badge variant="info">Paquete</Badge>;
  if (sesion.pago === "pagada") return <Estado tono="success">Pagada</Estado>;
  return <span className="text-muted-foreground">Sin cobro</span>;
}

export function SesionesPanel({
  pacienteId, sesiones,
}: {
  pacienteId: string;
  /** Ordenadas de la más reciente a la más antigua. */
  sesiones: Sesion[];
}) {
  const enOrden = [...sesiones].reverse();
  const presentes = new Set(sesiones.map(estadoVisual));
  // El historial puede tener decenas de filas iguales: se muestran las últimas y el resto a un clic.
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? sesiones : sesiones.slice(0, RECIENTES);
  const ocultas = sesiones.length - visibles.length;

  return (
    <section className="space-y-3.5" aria-labelledby="sesiones-titulo">
      <div className="flex items-baseline gap-3">
        <h2 id="sesiones-titulo" className="text-[1.1875rem] font-semibold tracking-[-0.01em]">Sesiones</h2>
        {sesiones.length > 0 && (
          <span className="text-muted-foreground text-[0.8125rem]">
            {sesiones.length} {sesiones.length === 1 ? "registrada" : "registradas"}
          </span>
        )}
      </div>

      {sesiones.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={CalendarPlus}
            title="Aún no hay sesiones"
            description="Registra la primera sesión o un paquete pagado por adelantado."
          />
        </div>
      ) : (
        <>
          {/* Línea: una casilla numerada por sesión, de la primera a la última. */}
          <div className="panel space-y-3.5 px-5 py-[1.125rem]">
            <ol className="flex flex-wrap gap-[5px]" aria-label="Línea de sesiones, de la primera a la última">
              {enOrden.map((s) => {
                const v = estadoVisual(s);
                return (
                  <li
                    key={s.id}
                    title={`Sesión ${s.numero} · ${ESTADO_VISUAL[v].label}${s.fecha ? ` · ${formatearFecha(s.fecha)}` : ""}`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-[5px] border font-mono text-[0.72rem]",
                      ESTADO_VISUAL[v].casilla,
                    )}
                  >
                    <span aria-hidden>{s.numero}</span>
                    <span className="sr-only">Sesión {s.numero}: {ESTADO_VISUAL[v].label}</span>
                  </li>
                );
              })}
            </ol>
            <ul className="text-secondary-foreground flex flex-wrap gap-x-[1.125rem] gap-y-1.5 text-[0.8125rem]">
              {(Object.keys(ESTADO_VISUAL) as EstadoVisual[]).filter((k) => presentes.has(k)).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("size-3 rounded-[3px] border", ESTADO_VISUAL[k].casilla)} /> {ESTADO_VISUAL[k].label}
                </li>
              ))}
            </ul>
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="w-14">N.º</th>
                  <th>Fecha</th>
                  <th>Asistencia</th>
                  <th>Pago</th>
                  <th>Nota</th>
                  <th className="w-12"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((s) => (
                  <tr key={s.id}>
                    <td className="text-muted-foreground font-mono text-[0.8125rem]">{s.numero}</td>
                    <td className="whitespace-nowrap">{formatearFecha(s.fecha)}</td>
                    <td
                      className={cn(
                        s.asistencia === "perdida" && "text-destructive font-medium",
                        s.asistencia === "pendiente" && "text-muted-foreground",
                      )}
                    >
                      {ASISTENCIA_LABEL[s.asistencia]}
                    </td>
                    <td><Pago sesion={s} pacienteId={pacienteId} /></td>
                    <td className="text-muted-foreground max-w-xs text-[0.8125rem]">{s.nota}</td>
                    <td className="py-1.5! pl-0! text-right"><EditarSesion sesion={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(ocultas > 0 || verTodas) && sesiones.length > RECIENTES && (
              <div className="border-border border-t p-1.5 text-center">
                <Button type="button" variant="ghost" className="text-link" onClick={() => setVerTodas((v) => !v)}>
                  {verTodas
                    ? "Ver solo las más recientes"
                    : `Ver las ${ocultas} sesiones anteriores`}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
