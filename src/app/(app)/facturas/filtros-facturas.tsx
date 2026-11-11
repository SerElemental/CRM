"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EMPRESA_LABEL, FACTURA_ESTADOS } from "@/lib/facturas/estados";

export type FiltrosFactura = { q: string; mes: string; empresa: string; estado: string };

function aUrl(f: FiltrosFactura) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/facturas?${s}` : "/facturas";
}

/** Filtros del repositorio de facturas. Se aplican al cambiar; el estado vive en la URL. */
export function FiltrosFacturas({ activos, empresas }: { activos: FiltrosFactura; empresas: string[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(activos.q);

  const ir = (f: FiltrosFactura) => iniciar(() => router.replace(aUrl(f), { scroll: false }));

  useEffect(() => {
    const q = texto.trim();
    if (q === activos.q) return;
    const t = setTimeout(() => ir({ ...activos, q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, activos]);

  const hay = Boolean(activos.q || activos.mes || activos.empresa || activos.estado);

  return (
    <section aria-label="Buscar y filtrar facturas" className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-0 flex-[1_1_17.5rem]">
        <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3.5 size-4" />
        <Input
          type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por número, cliente o paciente" aria-label="Buscar factura" className="pr-10 pl-10"
        />
        {pendiente && <Loader2 className="text-muted-foreground absolute top-3 right-10 size-4 animate-spin" />}
      </div>
      <Input
        type="month" value={activos.mes} aria-label="Mes" className="w-full sm:w-44"
        onChange={(e) => ir({ ...activos, mes: e.target.value })}
      />
      <select
        value={activos.empresa} aria-label="Empresa" className="control sm:w-44"
        onChange={(e) => ir({ ...activos, empresa: e.target.value })}
      >
        <option value="">Todas las empresas</option>
        {empresas.map((c) => <option key={c} value={c}>{EMPRESA_LABEL[c] ?? c}</option>)}
      </select>
      <select
        value={activos.estado} aria-label="Estado" className="control sm:w-44"
        onChange={(e) => ir({ ...activos, estado: e.target.value })}
      >
        <option value="">Todos los estados</option>
        {FACTURA_ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
      {hay && (
        <button
          type="button"
          onClick={() => { setTexto(""); ir({ q: "", mes: "", empresa: "", estado: "" }); }}
          className="enlace px-1.5 text-[0.8125rem]"
        >
          Limpiar
        </button>
      )}
    </section>
  );
}
