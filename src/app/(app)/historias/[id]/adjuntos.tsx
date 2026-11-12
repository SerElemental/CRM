"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subirAdjunto, type HistoriaState } from "../actions";

/** Diálogo para subir un archivo a la historia (genograma, consentimiento, resultados). */
export function SubirAdjunto({ pacienteId, sugerido }: { pacienteId: string; sugerido?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pendiente] = useActionState(async (_prev: HistoriaState, fd: FormData) => {
    const r = await subirAdjunto(fd);
    if (r?.ok) setAbierto(false);
    return r;
  }, undefined);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload /> {sugerido ? `Subir ${sugerido.toLowerCase()}` : "Subir archivo"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir archivo a la historia</DialogTitle>
          <DialogDescription>
            PDF, imagen o Word, de hasta 4 MB. Queda guardado en la historia y no se puede eliminar después.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="paciente_id" value={pacienteId} />
          <div className="space-y-1.5">
            <Label htmlFor="adj-nombre">Nombre</Label>
            <Input id="adj-nombre" name="nombre" required maxLength={200} defaultValue={sugerido ?? ""} placeholder="Consentimiento informado firmado" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-archivo">Archivo</Label>
            <Input
              id="adj-archivo" name="archivo" type="file" required className="h-11 py-2"
              accept="application/pdf,image/png,image/jpeg,image/webp,.docx"
            />
          </div>
          {state?.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente ? "Subiendo…" : "Subir"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
