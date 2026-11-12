"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Estado } from "@/components/ui/estado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HistoriaObjetivo, ObjetivoEstado } from "@/lib/database.types";
import { OBJETIVO_ESTADOS, OBJETIVO_LABEL, OBJETIVO_TONO } from "@/lib/historias";
import { agregarObjetivo, cambiarObjetivo, type HistoriaState } from "../actions";

function AgregarObjetivo({ pacienteId }: { pacienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pendiente] = useActionState(async (_prev: HistoriaState, fd: FormData) => {
    const r = await agregarObjetivo(fd);
    if (r?.ok) setAbierto(false);
    return r;
  }, undefined);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> Agregar objetivo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar objetivo</DialogTitle>
          <DialogDescription>Un tema del plan de trabajo, tal como lo nombras con el paciente.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <Label htmlFor="obj-nombre">Objetivo</Label>
            <Input id="obj-nombre" name="nombre" required maxLength={300} placeholder="Sanar vínculos familiares" className="h-11" />
          </div>
          {state?.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Agregar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Objetivos del plan de trabajo: estado de cada uno y en qué sesiones se trabajó. */
export function PlanDeTrabajo({
  pacienteId, objetivos, sesiones,
}: {
  pacienteId: string;
  objetivos: HistoriaObjetivo[];
  /** id del objetivo → «Sesiones 4 a 9 y 24». */
  sesiones: Record<string, string>;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambiar = (id: string, estado: ObjetivoEstado) =>
    iniciar(async () => {
      const r = await cambiarObjetivo(pacienteId, id, estado);
      setError(r?.error ?? null);
    });

  return (
    <section className="panel" aria-labelledby="plan-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <h2 id="plan-titulo" className="text-base font-semibold">Plan de trabajo</h2>
        <AgregarObjetivo pacienteId={pacienteId} />
      </div>
      {error && <p role="alert" className="text-destructive px-5 pb-3 text-sm">{error}</p>}
      {objetivos.length === 0 ? (
        <p className="border-border text-muted-foreground border-t px-5 py-5 text-sm">
          Aún no hay objetivos. Agrégalos para marcar, en cada nota, cuáles se trabajaron.
        </p>
      ) : (
        <ul>
          {objetivos.map((o) => (
            <li
              key={o.id}
              className="border-border grid items-center gap-x-4 gap-y-1.5 border-t px-5 py-3 sm:grid-cols-[minmax(0,1.4fr)_11rem_minmax(0,1fr)]"
            >
              <span className="font-medium">{o.nombre}</span>
              <span className="flex items-center gap-2.5">
                <Estado tono={OBJETIVO_TONO[o.estado]} className="sr-only">{OBJETIVO_LABEL[o.estado]}</Estado>
                <select
                  value={o.estado} disabled={pendiente} aria-label={`Estado de «${o.nombre}»`} className="control h-9"
                  onChange={(e) => cambiar(o.id, e.target.value as ObjetivoEstado)}
                >
                  {OBJETIVO_ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </span>
              <span className="text-muted-foreground text-[0.8125rem]">{sesiones[o.id] ?? "Aún sin sesiones"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
