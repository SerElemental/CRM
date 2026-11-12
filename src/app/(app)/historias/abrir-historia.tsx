"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Iniciales } from "@/components/ui/iniciales";
import { Input } from "@/components/ui/input";
import { abrirHistoria } from "./actions";

type Sugerencia = { id: string; nombre_completo: string; telefono: string | null; pais: string | null };

/** «Abrir historia»: se busca al paciente y se entra a su historia (si no la tiene, se crea). */
export function AbrirHistoria() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<Sugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abriendo, iniciar] = useTransition();

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    const control = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/pacientes/sugerencias?q=${encodeURIComponent(q)}`, { signal: control.signal });
        const datos = (await r.json()) as { sugerencias?: Sugerencia[] };
        setLista(datos.sugerencias ?? []);
      } catch {
        // Búsqueda cancelada o sin red: se deja la lista como estaba.
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [texto]);

  const visibles = texto.trim().length < 2 ? [] : lista;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>
        <Plus strokeWidth={2.2} /> Abrir historia
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir historia clínica</DialogTitle>
          <DialogDescription>
            Busca al paciente. Si ya tiene historia, se abre; si no, se crea en blanco.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-3.5 left-3.5 size-4" />
            <Input
              type="search" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Nombre, teléfono o correo" aria-label="Buscar paciente" className="h-11 pl-10"
            />
            {(buscando || abriendo) && <Loader2 className="text-muted-foreground absolute top-3.5 right-3.5 size-4 animate-spin" />}
          </div>
          {visibles.length > 0 ? (
            <ul className="border-border divide-border max-h-72 divide-y overflow-y-auto rounded-lg border">
              {visibles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button" disabled={abriendo}
                    onClick={() => iniciar(() => abrirHistoria(p.id))}
                    className="hover:bg-muted flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-60"
                  >
                    <Iniciales nombre={p.nombre_completo} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.nombre_completo}</span>
                      <span className="text-muted-foreground block truncate text-[0.8125rem]">
                        {[p.telefono, p.pais].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              {texto.trim().length < 2
                ? "Escribe al menos dos letras."
                : buscando ? "Buscando…" : "Ningún paciente coincide. Si es nuevo, créalo primero en Pacientes."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
