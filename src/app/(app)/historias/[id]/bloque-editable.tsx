"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CampoSeccion } from "@/lib/historias";
import { cn } from "@/lib/utils";
import { guardarSeccion } from "../actions";
import { IndicadorGuardado, useAutoguardado } from "../autoguardado";

/**
 * Un texto de la historia que se edita en el sitio: título, «Editar» y, al
 * editar, un área de texto que se guarda sola. `nivel` 2 es una sección; 3, un
 * sub-bloque dentro de otra (metas personales, metas laborales).
 */
export function BloqueEditable({
  pacienteId, campo, titulo, numero, nivel = 2, inicial, filas = 6, vacio = "Sin diligenciar.",
}: {
  pacienteId: string;
  campo: CampoSeccion;
  titulo: string;
  numero?: string;
  nivel?: 2 | 3;
  inicial: string | null;
  filas?: number;
  vacio?: string;
}) {
  const [texto, setTexto] = useState(inicial ?? "");
  const [editando, setEditando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const guardar = useCallback(
    (valor: string) => guardarSeccion({ paciente_id: pacienteId, campo, texto: valor }, false),
    [pacienteId, campo],
  );
  const { estado, error, programar, guardarYa } = useAutoguardado(guardar);

  async function listo() {
    setCerrando(true);
    const bien = await guardarYa();
    // Un último guardado que además refresca los contadores de la página.
    const r = bien ? await guardarSeccion({ paciente_id: pacienteId, campo, texto }, true) : undefined;
    setCerrando(false);
    if (bien && !r?.error) setEditando(false);
  }

  const Titulo = nivel === 2 ? "h2" : "h3";
  const id = `campo-${campo}`;

  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Titulo className={cn("font-semibold", nivel === 2 ? "text-base" : "text-[0.84rem]")}>
          {numero && <span className="text-muted-foreground mr-2 font-mono text-[0.8125rem] font-normal">{numero}</span>}
          {titulo}
        </Titulo>
        {editando ? (
          <IndicadorGuardado estado={estado} error={error} />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
            {texto.trim() ? "Editar" : "Completar"}
          </Button>
        )}
      </div>

      {editando ? (
        <div className="space-y-2.5">
          <label htmlFor={id} className="sr-only">{titulo}</label>
          <textarea
            id={id} autoFocus rows={filas} value={texto} className="control leading-relaxed"
            onChange={(e) => { setTexto(e.target.value); programar(e.target.value); }}
            onBlur={() => void guardarYa()}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-[0.8125rem]">Cada cambio queda en el historial con fecha, hora y autor.</p>
            <Button type="button" size="sm" onClick={listo} disabled={cerrando}>{cerrando ? "Guardando…" : "Listo"}</Button>
          </div>
        </div>
      ) : texto.trim() ? (
        <p className="text-secondary-foreground max-w-[72ch] leading-relaxed whitespace-pre-line">{texto}</p>
      ) : (
        <p className="text-muted-foreground">{vacio}</p>
      )}
    </div>
  );
}
