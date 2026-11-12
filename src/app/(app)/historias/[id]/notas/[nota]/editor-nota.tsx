"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import { Lock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmentado } from "@/components/ui/segmentado";
import type { HistoriaNota, NotaFormato } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import { FORMATOS, LISTA_FORMATOS } from "@/lib/historias/formatos";
import { MODALIDADES } from "@/lib/pacientes";
import type { DatosNota } from "@/lib/validations/historia";
import { cn } from "@/lib/utils";
import { eliminarBorrador, firmarNota, guardarNota, guardarNotaYSalir } from "../../../actions";
import { IndicadorGuardado, useAutoguardado } from "../../../autoguardado";

const DURACIONES = [30, 45, 60, 75, 90, 120];

/** Editor de una nota de sesión en borrador: se guarda sola y se cierra con «Firmar y cerrar». */
export function EditorNota({
  nota, paciente, objetivos, fechasLibres, hoy, children,
}: {
  nota: HistoriaNota;
  paciente: { id: string; nombre: string; historia: string; prepagadas: number };
  objetivos: { id: string; nombre: string }[];
  /** Fechas con una sesión en la ficha del paciente que todavía no tiene nota. */
  fechasLibres: string[];
  hoy: string;
  /** Contexto del paciente (sesión anterior, motivo, plan): va en la columna lateral. */
  children: ReactNode;
}) {
  const [datos, setDatos] = useState<DatosNota>({
    id: nota.id,
    paciente_id: paciente.id,
    fecha: nota.fecha,
    hora: nota.hora ? nota.hora.slice(0, 5) : null,
    duracion_min: nota.duracion_min,
    modalidad: nota.modalidad,
    formato: nota.formato,
    campos: nota.campos ?? {},
    objetivos: nota.objetivos ?? [],
  });
  const [firmando, setFirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [registro, setRegistro] = useState("pagada");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const guardar = useCallback((d: DatosNota) => guardarNota(d), []);
  const auto = useAutoguardado(guardar);

  function cambiar(parte: Partial<DatosNota>) {
    const nuevo = { ...datos, ...parte };
    setDatos(nuevo);
    auto.programar(nuevo);
  }
  const alternarObjetivo = (id: string) =>
    cambiar({ objetivos: datos.objetivos.includes(id) ? datos.objetivos.filter((o) => o !== id) : [...datos.objetivos, id] });

  const hayTexto = Object.values(datos.campos).some((t) => t.trim());
  const yaRegistrada = Boolean(datos.fecha && fechasLibres.includes(datos.fecha));
  const formato = FORMATOS[datos.formato];
  const duraciones = datos.duracion_min && !DURACIONES.includes(datos.duracion_min)
    ? [...DURACIONES, datos.duracion_min].sort((a, b) => a - b) : DURACIONES;

  const ejecutar = (accion: () => Promise<{ ok?: true; error?: string } | undefined>) =>
    iniciar(async () => {
      setError(null);
      await auto.guardarYa();
      const r = await accion();
      if (r?.error) setError(r.error);
    });

  function pedirFirma() {
    if (!datos.fecha) return setError("Escribe la fecha de la sesión antes de firmar.");
    if (!hayTexto) return setError("La nota está vacía: escribe el registro de la sesión antes de firmar.");
    setError(null);
    setFirmando(true);
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="titulo">Nota de la sesión {nota.numero}</h1>
          <div className="text-secondary-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm">
            <span>{paciente.nombre}</span>
            <span className="font-mono text-[0.8125rem]">{paciente.historia}</span>
            <Badge variant="warning">Borrador</Badge>
            <IndicadorGuardado estado={auto.estado} error={auto.error} />
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto">
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => ejecutar(() => guardarNotaYSalir(datos))}>
            Guardar y salir
          </Button>
          <Button type="button" disabled={ocupado} onClick={pedirFirma}>
            <Lock /> Firmar y cerrar
          </Button>
        </div>
      </header>

      {error && !firmando && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">{error}</p>
      )}

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <div className="panel min-w-0 flex-1">
          <div className="border-border grid gap-4 border-b px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="nota-fecha">Fecha</Label>
              <Input id="nota-fecha" type="date" max={hoy} value={datos.fecha ?? ""} onChange={(e) => cambiar({ fecha: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nota-hora">Hora</Label>
              <Input id="nota-hora" type="time" value={datos.hora ?? ""} onChange={(e) => cambiar({ hora: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nota-duracion">Duración</Label>
              <select
                id="nota-duracion" className="control" value={datos.duracion_min ?? ""}
                onChange={(e) => cambiar({ duracion_min: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Sin indicar</option>
                {duraciones.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nota-modalidad">Modalidad</Label>
              <select
                id="nota-modalidad" className="control" value={datos.modalidad ?? ""}
                onChange={(e) => cambiar({ modalidad: (e.target.value || null) as DatosNota["modalidad"] })}
              >
                <option value="">Sin indicar</option>
                {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {objetivos.length > 0 && (
            <div className="border-border space-y-2.5 border-b px-5 py-4">
              <p id="nota-objetivos" className="text-sm font-medium">Objetivos del plan de trabajo que se trabajaron hoy</p>
              <div role="group" aria-labelledby="nota-objetivos" className="flex flex-wrap gap-2">
                {objetivos.map((o) => {
                  const marcado = datos.objetivos.includes(o.id);
                  return (
                    <button
                      key={o.id} type="button" aria-pressed={marcado} onClick={() => alternarObjetivo(o.id)}
                      className={cn(
                        "min-h-9 rounded-full border px-3.5 py-1 text-left text-[0.84rem] font-medium transition-colors",
                        marcado ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                      )}
                    >
                      {o.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-5 px-5 pt-4 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <p className="rotulo">Registro de la sesión</p>
              <label className="text-secondary-foreground flex items-center gap-2 text-[0.84rem]">
                Formato
                <select
                  className="control h-9 w-auto" value={datos.formato}
                  onChange={(e) => cambiar({ formato: e.target.value as NotaFormato })}
                >
                  {LISTA_FORMATOS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
            </div>
            {formato.campos.map((c) => (
              <div key={c.clave} className="space-y-1.5">
                <Label htmlFor={`nota-${c.clave}`}>{c.label}</Label>
                <textarea
                  id={`nota-${c.clave}`} rows={c.filas} className="control leading-relaxed"
                  value={datos.campos[c.clave] ?? ""}
                  onChange={(e) => cambiar({ campos: { ...datos.campos, [c.clave]: e.target.value } })}
                  onBlur={() => void auto.guardarYa()}
                />
              </div>
            ))}
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground max-w-[60ch] text-[0.8125rem]">
                Mientras sea borrador se puede cambiar o eliminar. Al firmar queda bloqueada y solo admite adendas.
              </p>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={ocupado} onClick={() => setBorrando(true)}>
                <Trash2 /> Eliminar borrador
              </Button>
            </div>
          </div>
        </div>

        <aside aria-label="Contexto del paciente" className="w-full shrink-0 space-y-4 lg:w-80">{children}</aside>
      </div>

      <Dialog open={firmando} onOpenChange={setFirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Firmar la nota de la sesión {nota.numero}</DialogTitle>
            <DialogDescription>
              Queda con tu nombre, la fecha y la hora de este momento. Después no se puede modificar ni borrar: las correcciones van como adenda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {yaRegistrada ? (
              <p className="bg-muted rounded-lg px-3.5 py-3">
                La sesión del {formatearFecha(datos.fecha)} ya está en la ficha del paciente: la nota queda enlazada a ella.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label id="firma-registro">Sesión del {formatearFecha(datos.fecha)} en la ficha del paciente</Label>
                {paciente.prepagadas > 0 ? (
                  <Segmentado
                    name="registro" aria-labelledby="firma-registro" value={registro === "ninguno" ? "ninguno" : "pagada"} onChange={setRegistro}
                    opciones={[{ value: "pagada", label: "Descontar del paquete" }, { value: "ninguno", label: "No registrar" }]}
                  />
                ) : (
                  <Segmentado
                    name="registro" aria-labelledby="firma-registro" value={registro} onChange={setRegistro}
                    opciones={[
                      { value: "pagada", label: "Pagada" },
                      { value: "sin_pagar", label: "Sin pagar" },
                      { value: "ninguno", label: "No registrar" },
                    ]}
                  />
                )}
                <p className="text-muted-foreground text-[0.8125rem]">
                  {registro === "ninguno"
                    ? "Solo se firma la nota: la ficha del paciente no cambia."
                    : paciente.prepagadas > 0
                      ? `Se registra la sesión y se descuenta del paquete (quedan ${paciente.prepagadas}).`
                      : "Además de firmar, se registra la sesión en la ficha, para no escribirla dos veces."}
                </p>
              </div>
            )}
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFirmando(false)}>Seguir editando</Button>
            <Button
              type="button" disabled={ocupado}
              onClick={() => ejecutar(() => firmarNota(datos, registro as "pagada" | "sin_pagar" | "ninguno"))}
            >
              <Lock /> {ocupado ? "Firmando…" : "Firmar y cerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={borrando} onOpenChange={setBorrando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar el borrador de la sesión {nota.numero}</DialogTitle>
            <DialogDescription>
              Se pierde lo escrito en esta nota. Queda anotado en el historial que se eliminó un borrador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBorrando(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={ocupado} onClick={() => ejecutar(() => eliminarBorrador(paciente.id, nota.id))}>
              {ocupado ? "Eliminando…" : "Eliminar borrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
