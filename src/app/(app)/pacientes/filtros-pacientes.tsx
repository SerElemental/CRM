"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, X } from "lucide-react";
import {
  FILTROS, filtrosAUrl, hayFiltros, type ClaveFiltro, type FiltrosActivos, type Opcion,
} from "@/lib/pacientes-filtros";
import { cn } from "@/lib/utils";
import { BuscadorPacientes } from "./buscador-pacientes";

/** Milisegundos que se espera tras la última tecla antes de buscar. */
const ESPERA_BUSQUEDA = 350;

/**
 * Filtros del listado: buscador y, al lado, un desplegable con casillas por cada
 * filtro (se pueden marcar varias). Todo se aplica al instante, sin botón de
 * «aplicar». El estado vive en la URL, así que un filtro se puede compartir o
 * guardar como enlace.
 */
export function FiltrosPacientes({
  activos, opciones,
}: {
  activos: FiltrosActivos;
  opciones: Record<ClaveFiltro, Opcion[]>;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  // Las casillas responden al instante, sin esperar la respuesta del servidor.
  const [vista, setVista] = useOptimistic(activos);
  const [texto, setTexto] = useState(activos.q);

  const ir = (f: FiltrosActivos) =>
    iniciar(() => {
      setVista(f);
      router.replace(filtrosAUrl(f), { scroll: false });
    });

  // Búsqueda mientras se escribe, con una pequeña espera.
  useEffect(() => {
    const q = texto.trim();
    if (q === activos.q) return;
    const t = setTimeout(() => ir({ ...activos, q }), ESPERA_BUSQUEDA);
    return () => clearTimeout(t);
    // `ir` cambia en cada render; solo importa el texto y los filtros vigentes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, activos]);

  const alternar = (clave: ClaveFiltro, valor: string) => {
    const actuales = vista[clave];
    ir({
      ...vista,
      [clave]: actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor],
    });
  };
  const limpiarTodo = () => {
    setTexto("");
    ir({ q: "", pais: [], saldo: [], flyer: [], estado: [], plan: [], consentimiento: [] });
  };

  const etiqueta = (clave: ClaveFiltro, valor: string) =>
    opciones[clave].find((o) => o.value === valor)?.label ?? valor;

  return (
    <section aria-label="Buscar y filtrar pacientes" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-0 flex-[1_1_17.5rem]">
          <BuscadorPacientes valor={texto} alCambiar={setTexto} pendiente={pendiente} />
        </div>
        {FILTROS.map((f) => {
          const elegidos = vista[f.clave];
          return (
            <Popover.Root key={f.clave}>
              <Popover.Trigger
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border pr-3 pl-3.5 text-sm font-medium transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
                  elegidos.length ? "border-foreground bg-accent" : "border-input bg-card hover:bg-muted",
                )}
              >
                {f.titulo}
                {elegidos.length > 0 && (
                  <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums">
                    {elegidos.length}
                  </span>
                )}
                <ChevronDown className="text-muted-foreground size-3.5" strokeWidth={2.2} />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={6} align="start" className="z-50">
                  <Popover.Popup
                    aria-label={f.titulo}
                    className="bg-popover text-popover-foreground border-input max-h-80 min-w-60 overflow-y-auto rounded-xl border p-1.5 shadow-lg outline-none"
                  >
                    <ul>
                      {opciones[f.clave].map((o) => {
                        const marcado = elegidos.includes(o.value);
                        const vacio = !o.total && !marcado;
                        return (
                          <li key={o.value}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm select-none",
                                vacio ? "cursor-default opacity-45" : "hover:bg-muted",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={marcado}
                                disabled={vacio}
                                onChange={() => alternar(f.clave, o.value)}
                              />
                              <span
                                aria-hidden
                                className={cn(
                                  "peer-focus-visible:ring-ring/50 flex size-4 shrink-0 items-center justify-center rounded-sm border peer-focus-visible:ring-3",
                                  marcado ? "bg-primary border-primary text-primary-foreground" : "border-input bg-card",
                                )}
                              >
                                {marcado && <Check className="size-3" strokeWidth={3} />}
                              </span>
                              <span className="flex-1">{o.label}</span>
                              <span className="text-muted-foreground text-xs tabular-nums">{o.total ?? 0}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {elegidos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => ir({ ...vista, [f.clave]: [] })}
                        className="text-muted-foreground hover:text-foreground border-border mt-1 w-full border-t px-2.5 pt-2 pb-1 text-left text-xs"
                      >
                        Quitar este filtro
                      </button>
                    )}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          );
        })}
      </div>

      {hayFiltros(vista) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {vista.q && (
            <Chip texto={`Búsqueda: ${vista.q}`} alQuitar={() => { setTexto(""); ir({ ...vista, q: "" }); }} />
          )}
          {FILTROS.flatMap((f) =>
            vista[f.clave].map((v) => (
              <Chip
                key={`${f.clave}:${v}`}
                texto={`${f.titulo}: ${etiqueta(f.clave, v)}`}
                alQuitar={() => alternar(f.clave, v)}
              />
            )),
          )}
          <button type="button" onClick={limpiarTodo} className="enlace px-1.5 text-[0.8125rem]">
            Limpiar todo
          </button>
        </div>
      )}
    </section>
  );
}

function Chip({ texto, alQuitar }: { texto: string; alQuitar: () => void }) {
  return (
    <span className="bg-accent text-accent-foreground inline-flex h-7 items-center gap-1 rounded-[5px] pr-1 pl-2.5 text-[0.8125rem] font-medium">
      {texto}
      <button
        type="button"
        onClick={alQuitar}
        aria-label={`Quitar filtro ${texto}`}
        className="hover:bg-foreground/10 rounded-sm p-1"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
