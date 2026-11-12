"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmarImportacion, guardarDatosRevision, guardarFechaNota } from "../../actions";
import { IndicadorGuardado, useAutoguardado } from "../../autoguardado";

type NotaRevision = {
  id: string; numero: number; fecha: string | null; fechaTexto: string | null; encabezado: string | null; vacia: boolean;
};

/** Fila de una sesión importada: su fecha se puede corregir hasta que se confirme la historia. */
function FilaSesion({ pacienteId, nota, hoy }: { pacienteId: string; nota: NotaRevision; hoy: string }) {
  const [fecha, setFecha] = useState(nota.fecha ?? "");
  const guardar = useCallback((v: string) => guardarFechaNota(pacienteId, nota.id, v), [pacienteId, nota.id]);
  const { estado, error, programar, guardarYa } = useAutoguardado(guardar);
  const falta = !fecha;

  return (
    <li className={`border-border grid items-center gap-x-4 gap-y-1.5 border-t px-5 py-2.5 sm:grid-cols-[5.5rem_11rem_minmax(0,1fr)] ${falta ? "bg-warning-soft/50" : ""}`}>
      <span className="font-medium">Sesión {nota.numero}</span>
      <Input
        type="date" value={fecha} max={hoy} aria-label={`Fecha de la sesión ${nota.numero}`}
        aria-invalid={falta || undefined} className="h-9"
        onChange={(e) => { setFecha(e.target.value); programar(e.target.value); }}
        onBlur={() => void guardarYa()}
      />
      <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-[0.8125rem]">
        <span>
          {nota.encabezado ? `En el Word: «${nota.encabezado}»` : "Sin encabezado en el Word"}
          {nota.vacia && " · sin texto"}
        </span>
        <IndicadorGuardado estado={estado} error={error} />
      </span>
    </li>
  );
}

/** Lo que hay que mirar de una historia importada antes de confirmarla. */
export function Revision({
  pacienteId, documento, fechaConsulta, fechaConsultaTexto, hoy, avisos, notas, sesionesFicha, anterior, siguiente, children,
}: {
  pacienteId: string;
  documento: string | null;
  fechaConsulta: string | null;
  fechaConsultaTexto: string | null;
  hoy: string;
  avisos: string[];
  notas: NotaRevision[];
  /** Cuántas sesiones tiene registradas el paciente en su ficha (asistencia y cobro). */
  sesionesFicha: number;
  anterior: string | null;
  siguiente: string | null;
  children: ReactNode;
}) {
  const [datos, setDatos] = useState({ documento: documento ?? "", fecha_consulta: fechaConsulta ?? "" });
  const guardar = useCallback(
    (d: { documento: string; fecha_consulta: string }) => guardarDatosRevision(pacienteId, d),
    [pacienteId],
  );
  const auto = useAutoguardado(guardar);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function cambiar(parte: Partial<typeof datos>) {
    const nuevo = { ...datos, ...parte };
    setDatos(nuevo);
    auto.programar(nuevo);
  }
  const confirmar = () =>
    iniciar(async () => {
      setError(null);
      await auto.guardarYa();
      const r = await confirmarImportacion(pacienteId);
      if (r?.error) setError(r.error);
    });

  return (
    <>
      {avisos.length > 0 && (
        <section className="border-warning/50 bg-warning-soft/60 space-y-2 rounded-xl border px-5 py-4" aria-labelledby="avisos-titulo">
          <h3 id="avisos-titulo" className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="text-warning-foreground size-4" /> Lo que la importación no pudo resolver sola
          </h3>
          <ul className="text-secondary-foreground list-disc space-y-1 pl-5 text-[0.84rem]">
            {avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </section>
      )}

      <section className="panel space-y-4 px-5 py-4" aria-label="Datos por completar">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Datos que faltan en el Word</h3>
          <IndicadorGuardado estado={auto.estado} error={auto.error} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rev-documento">Documento del paciente</Label>
            <Input
              id="rev-documento" value={datos.documento} placeholder="C.C. 1.234.567" maxLength={60}
              onChange={(e) => cambiar({ documento: e.target.value })} onBlur={() => void auto.guardarYa()}
            />
            <p className="text-muted-foreground text-[0.8125rem]">La plantilla de Word no lo pedía. Se puede dejar para después.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rev-consulta">Fecha de consulta</Label>
            <Input
              id="rev-consulta" type="date" value={datos.fecha_consulta} max={hoy}
              onChange={(e) => cambiar({ fecha_consulta: e.target.value })} onBlur={() => void auto.guardarYa()}
            />
            {fechaConsultaTexto && !datos.fecha_consulta && (
              <p className="text-warning-foreground text-[0.8125rem]">En el Word decía «{fechaConsultaTexto}».</p>
            )}
          </div>
        </div>
      </section>

      {children}

      <section className="panel" aria-labelledby="sesiones-titulo">
        <div className="space-y-0.5 px-5 py-3.5">
          <h3 id="sesiones-titulo" className="font-semibold">
            {notas.length} {notas.length === 1 ? "sesión encontrada" : "sesiones encontradas"} en «Observaciones»
          </h3>
          <p className="text-secondary-foreground text-[0.84rem]">
            Cada una pasa a ser una nota de sesión. En la ficha del paciente hay {sesionesFicha}{" "}
            {sesionesFicha === 1 ? "sesión registrada" : "sesiones registradas"} (asistencia y cobro): no se tocan.
          </p>
        </div>
        {notas.length > 0 && (
          <ul>{notas.map((n) => <FilaSesion key={n.id} pacienteId={pacienteId} nota={n} hoy={hoy} />)}</ul>
        )}
      </section>

      {error && <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-[55ch] text-[0.8125rem]">
          Al confirmar, las sesiones quedan firmadas con la marca «Importada de Word»: el texto se conserva tal como estaba y solo admite adendas.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {anterior && <Link href={`/historias/importar/${anterior}`} className={buttonVariants({ variant: "outline" })}>Anterior</Link>}
          <Link href={siguiente ? `/historias/importar/${siguiente}` : "/historias/importar"} className={buttonVariants({ variant: "outline" })}>
            Dejar para después
          </Link>
          <Button type="button" onClick={() => setConfirmando(true)}>
            {siguiente ? "Confirmar y seguir" : "Confirmar"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar la revisión</DialogTitle>
            <DialogDescription>
              {notas.length === 0
                ? "La historia queda como revisada."
                : `${notas.length === 1 ? "La sesión importada queda firmada" : `Las ${notas.length} sesiones importadas quedan firmadas`} con tu nombre y la fecha de hoy. Después no se pueden modificar: las correcciones van como adenda.`}
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>Seguir revisando</Button>
            <Button type="button" disabled={ocupado} onClick={confirmar}>{ocupado ? "Confirmando…" : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
