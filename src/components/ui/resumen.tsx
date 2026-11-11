import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DatoResumen = {
  titulo: string;
  valor: ReactNode;
  detalle?: ReactNode;
  /** Clase de color del valor, cuando hay algo que atender (p. ej. `text-warning-foreground`). */
  tono?: string;
};

/**
 * Tira de cifras en un solo panel, separadas por líneas. `className` define
 * las columnas (`sm:grid-cols-2 lg:grid-cols-4`).
 */
export function Resumen({ datos, className, ...props }: { datos: DatoResumen[]; className?: string; "aria-label"?: string }) {
  return (
    // El fondo del contenedor asoma por los huecos de 1 px: así quedan las líneas divisorias.
    <section {...props} className={cn("border-border bg-border grid gap-px overflow-hidden rounded-xl border", className)}>
      {datos.map((d) => (
        <div key={d.titulo} className="bg-card flex flex-col gap-1 px-5 py-4 md:px-6 md:py-5">
          <p className="rotulo">{d.titulo}</p>
          <p className={cn("text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums", d.tono)}>{d.valor}</p>
          {d.detalle && <p className="text-muted-foreground text-[0.8125rem]">{d.detalle}</p>}
        </div>
      ))}
    </section>
  );
}
