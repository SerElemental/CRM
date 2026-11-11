"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, PackagePlus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sesion } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import { ASISTENCIA_LABEL, ESTADO_VISUAL, PAGO_LABEL, estadoVisual, type EstadoVisual } from "@/lib/sesiones";
import { cn } from "@/lib/utils";
import {
  cobrarSesion, editarSesion, eliminarSesion, registrarPaquete, registrarSesion, type SesionState,
} from "./sesion-actions";

/** Cuántas sesiones se ven en la tabla antes de «ver anteriores». */
const RECIENTES = 12;

type Resumen = { realizadas: number; porCobrar: number; prepagadas: number; perdidas: number };

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

function Contador({ valor, titulo, detalle, tono }: { valor: number; titulo: string; detalle: string; tono?: string }) {
  return (
    <div className="bg-card ring-foreground/[0.06] rounded-xl p-4 shadow-sm ring-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", valor > 0 && tono)}>{valor}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{detalle}</p>
    </div>
  );
}

function RegistrarSesion({ pacienteId, hoy, prepagadas }: { pacienteId: string; hoy: string; prepagadas: number }) {
  const [abierto, setAbierto] = useState(false);
  const [asistencia, setAsistencia] = useState<"realizada" | "perdida">("realizada");
  const [state, action, pendiente] = useAccion(registrarSesion, () => setAbierto(false));

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>
        <CalendarPlus /> Registrar sesión
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar sesión</DialogTitle>
          <DialogDescription>
            {prepagadas > 0
              ? `Se descuenta del paquete: quedan ${prepagadas} ${prepagadas === 1 ? "sesión prepagada" : "sesiones prepagadas"}.`
              : "Queda como la siguiente sesión del proceso."}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <Label htmlFor="rs-fecha">Fecha</Label>
            <Input id="rs-fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-asistencia">¿Qué pasó?</Label>
            <select
              id="rs-asistencia" name="asistencia" className="control"
              value={asistencia} onChange={(e) => setAsistencia(e.target.value as "realizada" | "perdida")}
            >
              <option value="realizada">La sesión se realizó</option>
              <option value="perdida">No asistió (sesión perdida)</option>
            </select>
          </div>
          {prepagadas > 0 ? (
            <input type="hidden" name="pago" value="pagada" />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="rs-pago">Pago</Label>
              {asistencia === "realizada" ? (
                <select id="rs-pago" name="pago" className="control" defaultValue="pagada" key="realizada">
                  <option value="pagada">Pagada</option>
                  <option value="sin_pagar">Sin pagar (queda por cobrar)</option>
                </select>
              ) : (
                <select id="rs-pago" name="pago" className="control" defaultValue="no_aplica" key="perdida">
                  <option value="no_aplica">Sin cobro</option>
                  <option value="sin_pagar">Con multa por cobrar</option>
                </select>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rs-nota">Nota (opcional)</Label>
            <textarea id="rs-nota" name="nota" rows={2} className="control" />
          </div>
          <ErrorForm state={state} />
          <DialogFooter>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarPaquete({ pacienteId }: { pacienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pendiente] = useAccion(registrarPaquete, () => setAbierto(false));

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PackagePlus /> Registrar paquete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar paquete</DialogTitle>
          <DialogDescription>
            Sesiones pagadas por adelantado. Quedan disponibles y se van descontando al registrar cada sesión.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <Label htmlFor="rp-cantidad">Número de sesiones</Label>
            <Input id="rp-cantidad" name="cantidad" type="number" min={1} max={50} defaultValue={4} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-nota">Nota (opcional)</Label>
            <textarea id="rp-nota" name="nota" rows={2} className="control" />
          </div>
          <ErrorForm state={state} />
          <DialogFooter>
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
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Editar sesión ${sesion.numero}`} />}>
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesión {sesion.numero}</DialogTitle>
          {sesion.origen === "excel" && <DialogDescription>Importada del Excel.</DialogDescription>}
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={sesion.id} />
          <input type="hidden" name="paciente_id" value={sesion.paciente_id} />
          <div className="space-y-1.5">
            <Label htmlFor={`es-fecha-${sesion.id}`}>Fecha</Label>
            <Input id={`es-fecha-${sesion.id}`} name="fecha" type="date" defaultValue={sesion.fecha ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`es-asis-${sesion.id}`}>Asistencia</Label>
              <select id={`es-asis-${sesion.id}`} name="asistencia" className="control" defaultValue={sesion.asistencia}>
                <option value="realizada">Realizada</option>
                <option value="pendiente">Pendiente (por tener)</option>
                <option value="perdida">Perdida</option>
              </select>
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

export function SesionesPanel({
  pacienteId, sesiones, resumen, hoy,
}: {
  pacienteId: string;
  /** Ordenadas de la más reciente a la más antigua. */
  sesiones: Sesion[];
  resumen: Resumen;
  hoy: string;
}) {
  const enOrden = [...sesiones].reverse();
  const presentes = new Set(sesiones.map(estadoVisual));
  // El historial puede tener decenas de filas iguales: se muestran las últimas y el resto a un clic.
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? sesiones : sesiones.slice(0, RECIENTES);
  const ocultas = sesiones.length - visibles.length;

  return (
    <section className="space-y-4" aria-labelledby="sesiones-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sesiones-titulo" className="text-lg font-semibold tracking-tight">Sesiones</h2>
        <div className="flex flex-wrap gap-2">
          <RegistrarPaquete pacienteId={pacienteId} />
          <RegistrarSesion pacienteId={pacienteId} hoy={hoy} prepagadas={resumen.prepagadas} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador valor={resumen.realizadas} titulo="Realizadas" detalle="sesiones que ya tuvo" />
        <Contador valor={resumen.porCobrar} titulo="Por cobrar" detalle="tenidas y sin pagar" tono="text-warning-foreground" />
        <Contador valor={resumen.prepagadas} titulo="Prepagadas" detalle="pagadas, por tener" tono="text-info" />
        <Contador valor={resumen.perdidas} titulo="Perdidas" detalle="no asistió" tono="text-destructive" />
      </div>

      {sesiones.length === 0 ? (
        <div className="tabla-wrap">
          <EmptyState
            icon={CalendarPlus}
            title="Aún no hay sesiones"
            description="Registra la primera sesión o un paquete pagado por adelantado."
          />
        </div>
      ) : (
        <>
          {/* Tira: un punto por sesión, de la primera a la última. */}
          <div className="bg-card ring-foreground/[0.06] rounded-xl p-4 shadow-sm ring-1">
            <ol className="flex flex-wrap gap-1.5" aria-label="Línea de sesiones, de la primera a la última">
              {enOrden.map((s) => {
                const v = estadoVisual(s);
                return (
                  <li
                    key={s.id}
                    title={`Sesión ${s.numero} · ${ESTADO_VISUAL[v].label}${s.fecha ? ` · ${formatearFecha(s.fecha)}` : ""}`}
                    className={cn("size-3 rounded-full", ESTADO_VISUAL[v].punto)}
                  >
                    <span className="sr-only">Sesión {s.numero}: {ESTADO_VISUAL[v].label}</span>
                  </li>
                );
              })}
            </ol>
            <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {(Object.keys(ESTADO_VISUAL) as EstadoVisual[]).filter((k) => presentes.has(k)).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", ESTADO_VISUAL[k].punto)} /> {ESTADO_VISUAL[k].label}
                </li>
              ))}
            </ul>
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="w-14">#</th>
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
                    <td className="text-muted-foreground tabular-nums">{s.numero}</td>
                    <td className="whitespace-nowrap">{formatearFecha(s.fecha)}</td>
                    <td>
                      <Badge variant={s.asistencia === "realizada" ? "secondary" : s.asistencia === "perdida" ? "destructive" : "outline"}>
                        {ASISTENCIA_LABEL[s.asistencia]}
                      </Badge>
                    </td>
                    <td>
                      {s.pago === "sin_pagar" ? (
                        <form action={cobrarSesion.bind(null, pacienteId, s.id)} className="flex items-center gap-2">
                          <Badge variant="warning">Sin pagar</Badge>
                          <Button type="submit" variant="outline" size="xs">Cobrar</Button>
                        </form>
                      ) : s.pago === "no_aplica" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={s.pago === "paquete" ? "outline" : "success"} className={s.pago === "paquete" ? "border-info/40 text-info" : undefined}>
                          {PAGO_LABEL[s.pago]}
                        </Badge>
                      )}
                    </td>
                    <td className="text-muted-foreground max-w-xs text-xs">{s.nota}</td>
                    <td className="text-right"><EditarSesion sesion={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(ocultas > 0 || verTodas) && sesiones.length > RECIENTES && (
              <div className="border-border border-t p-2 text-center">
                <Button type="button" variant="ghost" size="sm" onClick={() => setVerTodas((v) => !v)}>
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
