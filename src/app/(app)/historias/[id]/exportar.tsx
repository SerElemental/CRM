"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Alcance = "todo" | "valoracion" | "rango";

const ALCANCES: { value: Alcance; nombre: string; detalle: string }[] = [
  { value: "todo", nombre: "Historia completa", detalle: "valoración, plan y notas" },
  { value: "valoracion", nombre: "Solo la valoración inicial", detalle: "identificación y secciones 1 a 5" },
  { value: "rango", nombre: "Un rango de sesiones", detalle: "se eligen las fechas" },
];

/** Diálogo de exportación: qué entra en el PDF. El archivo sale sin clave. */
export function ExportarHistoria({
  pacienteId, archivo, firmadas, borradores, hoy, primeraFecha,
}: {
  pacienteId: string;
  /** Nombre con el que se descarga, sin la extensión. */
  archivo: string;
  firmadas: number;
  borradores: number;
  hoy: string;
  primeraFecha: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [alcance, setAlcance] = useState<Alcance>("todo");
  const [desde, setDesde] = useState(primeraFecha ?? hoy);
  const [hasta, setHasta] = useState(hoy);
  const [adendas, setAdendas] = useState(true);
  const [imagenes, setImagenes] = useState(false);
  const [conBorradores, setConBorradores] = useState(false);

  const p = new URLSearchParams({ alcance, descargar: "1" });
  if (alcance === "rango") { p.set("desde", desde); p.set("hasta", hasta); }
  if (alcance !== "valoracion") {
    if (adendas) p.set("adendas", "1");
    if (conBorradores) p.set("borradores", "1");
  }
  if (imagenes) p.set("imagenes", "1");
  const rangoMal = alcance === "rango" && (!desde || !hasta || desde > hasta);

  const contenido =
    alcance === "todo"
      ? `Valoración inicial, plan de trabajo y ${firmadas} ${firmadas === 1 ? "nota firmada" : "notas firmadas"}`
      : alcance === "valoracion"
        ? "Datos de identificación y secciones 1 a 5"
        : "Las notas de sesión entre las dos fechas";

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FileDown /> Exportar PDF
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Exportar historia clínica</DialogTitle>
          <DialogDescription>Elige qué entra en el PDF. Cada exportación queda en el historial.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Qué incluye el PDF</legend>
            {ALCANCES.map((a) => (
              <label
                key={a.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2",
                  alcance === a.value ? "border-foreground bg-background" : "border-border",
                )}
              >
                <input
                  type="radio" name="alcance" value={a.value} checked={alcance === a.value}
                  onChange={() => setAlcance(a.value)} className="accent-foreground size-4"
                />
                <span className="flex-1 text-sm font-medium">{a.nombre}</span>
                <span className="text-muted-foreground hidden text-[0.8125rem] sm:block">{a.detalle}</span>
              </label>
            ))}
          </fieldset>

          {alcance === "rango" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ex-desde">Desde</Label>
                <Input id="ex-desde" type="date" value={desde} max={hoy} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-hasta">Hasta</Label>
                <Input id="ex-hasta" type="date" value={hasta} max={hoy} onChange={(e) => setHasta(e.target.value)} />
              </div>
              {rangoMal && <p role="alert" className="text-destructive text-sm sm:col-span-2">La fecha «desde» debe ser anterior a «hasta».</p>}
            </div>
          )}

          <fieldset className="space-y-1">
            <legend className="mb-1.5 text-sm font-medium">También</legend>
            {alcance !== "valoracion" && (
              <label className="flex min-h-9 items-center gap-2.5 text-sm">
                <input type="checkbox" checked={adendas} onChange={(e) => setAdendas(e.target.checked)} className="accent-foreground size-4" />
                Incluir adendas
              </label>
            )}
            <label className="flex min-h-9 items-center gap-2.5 text-sm">
              <input type="checkbox" checked={imagenes} onChange={(e) => setImagenes(e.target.checked)} className="accent-foreground size-4" />
              Incluir las imágenes adjuntas (genograma)
            </label>
            {alcance !== "valoracion" && borradores > 0 && (
              <label className="flex min-h-9 items-center gap-2.5 text-sm">
                <input type="checkbox" checked={conBorradores} onChange={(e) => setConBorradores(e.target.checked)} className="accent-foreground size-4" />
                Incluir {borradores === 1 ? "la nota en borrador" : `las ${borradores} notas en borrador`} (salen marcadas como borrador)
              </label>
            )}
          </fieldset>

          <dl className="border-border bg-background grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg border px-4 py-3 text-[0.84rem]">
            <dt className="text-muted-foreground">Archivo</dt>
            <dd className="font-mono text-[0.8125rem] break-words">{archivo}.pdf</dd>
            <dt className="text-muted-foreground">Contenido</dt>
            <dd>{contenido}</dd>
          </dl>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <a
            href={rangoMal ? undefined : `/historias/${pacienteId}/pdf?${p.toString()}`}
            aria-disabled={rangoMal} onClick={() => !rangoMal && setAbierto(false)}
            className={cn(buttonVariants(), rangoMal && "pointer-events-none opacity-50")}
          >
            <FileDown /> Exportar PDF
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
