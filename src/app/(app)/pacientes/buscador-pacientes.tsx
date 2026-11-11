"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PacienteEstado } from "@/lib/database.types";
import { ESTADO_BADGE, ESTADO_LABEL } from "@/lib/pacientes";
import { MIN_LETRAS, detalleSugerencia, resaltar, type Sugerencia } from "@/lib/sugerencias";
import { cn } from "@/lib/utils";

/** Milisegundos de espera tras la última tecla antes de pedir sugerencias. */
const ESPERA = 150;

type Resultado = { consulta: string; sugerencias: Sugerencia[]; total: number };

/**
 * Buscador con autocompletado. Mientras se escribe muestra los pacientes que
 * coinciden; al elegir uno se abre su ficha. El texto, además, filtra el listado
 * (eso lo hace el componente padre con `alCambiar`).
 */
export function BuscadorPacientes({
  valor, alCambiar, pendiente,
}: {
  valor: string;
  alCambiar: (texto: string) => void;
  pendiente: boolean;
}) {
  const router = useRouter();
  const idLista = useId();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const consulta = valor.trim();
  const suficiente = consulta.length >= MIN_LETRAS;

  useEffect(() => {
    if (!suficiente) return;
    const control = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/pacientes/sugerencias?q=${encodeURIComponent(consulta)}`, {
          signal: control.signal,
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw new Error(String(r.status));
        const datos = (await r.json()) as { sugerencias: Sugerencia[]; total: number };
        setResultado({ consulta, ...datos });
        setActivo(-1);
      } catch {
        // Petición cancelada (se siguió escribiendo) o sin conexión: se deja lo que había.
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, ESPERA);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [consulta, suficiente]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    const alPulsar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", alPulsar);
    return () => document.removeEventListener("pointerdown", alPulsar);
  }, []);

  // Solo se muestran sugerencias que corresponden a lo que hay escrito ahora.
  const sugerencias = suficiente && resultado ? resultado.sugerencias : [];
  const total = suficiente && resultado ? resultado.total : 0;
  const visible = abierto && suficiente && resultado !== null;
  const sinResultados = visible && sugerencias.length === 0 && !buscando;

  const abrirFicha = (s: Sugerencia) => {
    setAbierto(false);
    router.push(`/pacientes/${s.id}`);
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (visible) e.preventDefault();
      setAbierto(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugerencias.length) return;
      e.preventDefault();
      setAbierto(true);
      const paso = e.key === "ArrowDown" ? 1 : -1;
      // De la última se vuelve al cuadro de texto (-1) y de ahí a la primera.
      setActivo((i) => {
        const n = i + paso;
        return n >= sugerencias.length ? -1 : n < -1 ? sugerencias.length - 1 : n;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (visible && activo >= 0 && sugerencias[activo]) abrirFicha(sugerencias[activo]);
      else setAbierto(false); // el listado de abajo ya está filtrado con este texto
    }
  };

  return (
    <div ref={caja} className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
      <Input
        type="search"
        role="combobox"
        aria-label="Buscar paciente"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={idLista}
        aria-activedescendant={visible && activo >= 0 ? `${idLista}-${activo}` : undefined}
        autoComplete="off"
        value={valor}
        onChange={(e) => {
          alCambiar(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
        placeholder="Buscar por nombre, teléfono o correo"
        className="pr-16 pl-9"
      />
      {/* A la izquierda de la «x» de borrar que pone el navegador en los campos de búsqueda. */}
      {(pendiente || buscando) && (
        <Loader2 className="text-muted-foreground absolute top-2.5 right-10 size-4 animate-spin" aria-label="Buscando" />
      )}

      {visible && (
        <div className="bg-popover text-popover-foreground ring-foreground/10 absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl shadow-lg ring-1">
          {sinResultados ? (
            <p className="text-muted-foreground px-3.5 py-3 text-sm">
              Ningún paciente coincide con «{consulta}».
            </p>
          ) : (
            <ul id={idLista} role="listbox" aria-label="Pacientes que coinciden" className="max-h-[28rem] overflow-y-auto p-1.5">
              {sugerencias.map((s, i) => {
                const detalle = detalleSugerencia(s, consulta);
                return (
                  <li
                    key={s.id}
                    id={`${idLista}-${i}`}
                    role="option"
                    aria-selected={i === activo}
                    // pointerdown y no click: así el cuadro de texto no pierde el foco antes de elegir.
                    onPointerDown={(e) => {
                      e.preventDefault();
                      abrirFicha(s);
                    }}
                    onPointerMove={() => setActivo(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                      i === activo && "bg-accent",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {resaltar(s.nombre_completo, consulta).map((t, k) =>
                          t.coincide ? (
                            <mark key={k} className="text-foreground bg-transparent font-semibold">{t.texto}</mark>
                          ) : (
                            <span key={k} className="text-muted-foreground">{t.texto}</span>
                          ),
                        )}
                      </p>
                      {(detalle || s.pais) && (
                        <p className="text-muted-foreground truncate text-xs">
                          {[detalle, s.pais].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <Badge variant={ESTADO_BADGE[s.estado as PacienteEstado] ?? "secondary"}>
                      {ESTADO_LABEL[s.estado as PacienteEstado] ?? s.estado}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {total > sugerencias.length && (
            <p className="text-muted-foreground border-border border-t px-3.5 py-2 text-xs">
              {sugerencias.length} de {total} coincidencias. Sigue escribiendo para afinar, o pulsa Enter para verlas todas en la lista.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
