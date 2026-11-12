"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Historia } from "@/lib/database.types";
import { IDENTIFICACION } from "@/lib/historias";
import { guardarIdentificacion, type HistoriaState } from "../actions";

/** Diálogo para editar los datos de identificación propios de la historia (y el documento). */
export function EditarIdentificacion({
  historia, documento, hoy,
}: {
  historia: Historia; documento: string | null; hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pendiente] = useActionState(async (prev: HistoriaState, fd: FormData) => {
    const r = await guardarIdentificacion(prev, fd);
    if (r?.ok) setAbierto(false);
    return r;
  }, undefined);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Editar</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Datos de identificación</DialogTitle>
          <DialogDescription>
            El nombre, el teléfono y el correo se cambian en la ficha del paciente.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="paciente_id" value={historia.paciente_id} />
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto p-0.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="id-documento">Documento</Label>
              <Input id="id-documento" name="documento" defaultValue={documento ?? ""} placeholder="C.C. 1.234.567" />
            </div>
            {IDENTIFICACION.map((c) => (
              <div key={c.campo} className="space-y-1.5">
                <Label htmlFor={`id-${c.campo}`}>{c.label}</Label>
                <Input
                  id={`id-${c.campo}`} name={c.campo} type={c.tipo ?? "text"} max={c.tipo === "date" ? hoy : undefined}
                  defaultValue={(historia[c.campo] as string | null) ?? ""}
                />
                {c.campo === "fecha_nacimiento" && !historia.fecha_nacimiento && historia.edad_texto && (
                  <p className="text-muted-foreground text-[0.8125rem]">En el archivo original decía «{historia.edad_texto}».</p>
                )}
                {c.campo === "fecha_consulta" && !historia.fecha_consulta && historia.fecha_consulta_texto && (
                  <p className="text-muted-foreground text-[0.8125rem]">En el archivo original decía «{historia.fecha_consulta_texto}».</p>
                )}
              </div>
            ))}
          </div>
          {state?.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
