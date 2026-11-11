"use client";

import { useActionState, useState } from "react";
import { Ban, CircleCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FacturaEstado } from "@/lib/database.types";
import { anularFactura, marcarFacturaPagada, reabrirFactura, type FacturaState } from "../actions";

/** Lo único que se le puede hacer a una factura emitida: pagarla, reabrirla o anularla. */
export function AccionesFactura({
  id, numero, estado, pacienteId, hoy,
}: {
  id: string; numero: string; estado: FacturaEstado; pacienteId: string | null; hoy: string;
}) {
  const [pagar, setPagar] = useState(false);
  const [anular, setAnular] = useState(false);
  const [anulacion, accionAnular, anulando] = useActionState(
    async (prev: FacturaState, fd: FormData) => {
      const r = await anularFactura(id, pacienteId, prev, fd);
      if (r?.ok) setAnular(false);
      return r;
    },
    undefined,
  );

  if (estado === "anulada") return null;

  return (
    <>
      {estado === "emitida" && (
        <Dialog open={pagar} onOpenChange={setPagar}>
          <DialogTrigger render={<Button />}>
            <CircleCheck /> Marcar como pagada
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar {numero} como pagada</DialogTitle>
              <DialogDescription>
                Las sesiones que cubre este documento y seguían sin pagar quedarán pagadas.
              </DialogDescription>
            </DialogHeader>
            <form
              action={async (fd) => {
                await marcarFacturaPagada(id, pacienteId, fd);
                setPagar(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="fecha-pago">Fecha del pago</Label>
                <Input id="fecha-pago" name="fecha" type="date" defaultValue={hoy} max={hoy} required />
              </div>
              <DialogFooter>
                <Button type="submit">Marcar como pagada</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {estado === "pagada" && (
        <form action={reabrirFactura.bind(null, id, pacienteId)}>
          <Button type="submit" variant="outline">
            <RotateCcw /> Quitar el pago
          </Button>
        </form>
      )}

      <Dialog open={anular} onOpenChange={setAnular}>
        <DialogTrigger render={<Button variant="ghost" className="text-destructive" />}>
          <Ban /> Anular
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular {numero}</DialogTitle>
            <DialogDescription>
              El documento conserva su número y queda marcado como anulado; no se puede deshacer. Las sesiones
              que cubría vuelven a quedar disponibles para facturar.
            </DialogDescription>
          </DialogHeader>
          <form action={accionAnular} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <textarea id="motivo" name="motivo" rows={2} className="control" required placeholder="Ej. valor equivocado" />
            </div>
            {anulacion?.error && <p role="alert" className="text-destructive text-sm">{anulacion.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAnular(false)}>Volver</Button>
              <Button type="submit" variant="destructive" disabled={anulando}>
                {anulando ? "Anulando…" : "Sí, anular"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
