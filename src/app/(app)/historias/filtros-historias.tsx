"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ESTADOS_HISTORIA } from "@/lib/historias";

export type FiltrosHistoria = { q: string; estado: string; pendiente: string };

function aUrl(f: FiltrosHistoria) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/historias?${s}` : "/historias";
}

/** Buscador y filtros del listado de historias. Se aplican al cambiar; el estado vive en la URL. */
export function FiltrosHistorias({ activos }: { activos: FiltrosHistoria }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(activos.q);

  const ir = (f: FiltrosHistoria) => iniciar(() => router.replace(aUrl(f), { scroll: false }));

  useEffect(() => {
    const q = texto.trim();
    if (q === activos.q) return;
    const t = setTimeout(() => ir({ ...activos, q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, activos]);

  const hay = Boolean(activos.q || activos.estado || activos.pendiente);

  return (
    <section aria-label="Buscar y filtrar historias" className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-0 flex-[1_1_17.5rem]">
        <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3.5 size-4" />
        <Input
          type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre o documento" aria-label="Buscar historia" className="pr-10 pl-10"
        />
        {pendiente && <Loader2 className="text-muted-foreground absolute top-3 right-10 size-4 animate-spin" />}
      </div>
      <select
        value={activos.estado} aria-label="Estado de la historia" className="control sm:w-52"
        onChange={(e) => ir({ ...activos, estado: e.target.value })}
      >
        <option value="">Todas las historias</option>
        {ESTADOS_HISTORIA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
      <select
        value={activos.pendiente} aria-label="Pendientes" className="control sm:w-52"
        onChange={(e) => ir({ ...activos, pendiente: e.target.value })}
      >
        <option value="">Con o sin pendientes</option>
        <option value="firmar">Con notas por firmar</option>
        <option value="documento">Sin documento</option>
      </select>
      {hay && (
        <button
          type="button"
          onClick={() => { setTexto(""); ir({ q: "", estado: "", pendiente: "" }); }}
          className="enlace px-1.5 text-[0.8125rem]"
        >
          Limpiar
        </button>
      )}
    </section>
  );
}
