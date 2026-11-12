"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Resultado = { ok?: true; error?: string } | undefined;
export type EstadoGuardado = "quieto" | "pendiente" | "guardando" | "guardado" | "error";

/** Cuánto se espera sin teclear antes de guardar. */
const ESPERA_MS = 1200;

/**
 * Autoguardado: `programar(valor)` en cada cambio y `guardarYa()` cuando hay
 * que estar seguros (al salir del campo, al firmar). Si llegan cambios mientras
 * se está guardando, se guarda otra vez con lo último: nunca se pisa lo nuevo
 * con lo viejo. `guardar` debe ser estable (`useCallback`).
 */
export function useAutoguardado<T>(guardar: (valor: T) => Promise<Resultado>) {
  const [estado, setEstado] = useState<EstadoGuardado>("quieto");
  const [error, setError] = useState<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<{ valor: T } | null>(null);
  const enCurso = useRef<Promise<boolean> | null>(null);

  const guardarYa = useCallback((): Promise<boolean> => {
    if (reloj.current) {
      clearTimeout(reloj.current);
      reloj.current = null;
    }
    if (enCurso.current) return enCurso.current;
    if (!pendiente.current) return Promise.resolve(true);

    const ciclo = (async () => {
      let bien = true;
      while (pendiente.current) {
        const { valor } = pendiente.current;
        pendiente.current = null;
        setEstado("guardando");
        try {
          const r = await guardar(valor);
          bien = !r?.error;
          if (r?.error) setError(r.error);
        } catch {
          bien = false;
          setError("No se pudo guardar. Revisa la conexión.");
        }
      }
      enCurso.current = null;
      setEstado(bien ? "guardado" : "error");
      if (bien) setError(null);
      return bien;
    })();
    enCurso.current = ciclo;
    return ciclo;
  }, [guardar]);

  const programar = useCallback(
    (valor: T) => {
      pendiente.current = { valor };
      setEstado((e) => (e === "guardando" ? e : "pendiente"));
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = setTimeout(() => void guardarYa(), ESPERA_MS);
    },
    [guardarYa],
  );

  // Si se cierra o se recarga con algo sin guardar, el navegador pregunta antes.
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (pendiente.current || enCurso.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, []);

  return { estado, error, programar, guardarYa };
}

/** «Guardado» / «Guardando…» / el error, junto al campo que se está editando. */
export function IndicadorGuardado({ estado, error, className }: { estado: EstadoGuardado; error: string | null; className?: string }) {
  if (estado === "quieto") return null;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8125rem]",
        estado === "error" ? "text-destructive" : estado === "guardado" ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      {estado === "guardado" && <><Check className="size-3.5" strokeWidth={2.4} /> Guardado</>}
      {(estado === "guardando" || estado === "pendiente") && <><Loader2 className="size-3.5 animate-spin" /> Guardando…</>}
      {estado === "error" && <><CloudAlert className="size-3.5" /> {error ?? "No se pudo guardar."}</>}
    </span>
  );
}
