import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Estado } from "@/components/ui/estado";
import { Iniciales } from "@/components/ui/iniciales";
import { formatearFecha } from "@/lib/fecha";
import { ESTADO_LABEL, ESTADO_TONO, TIPO_LABEL } from "@/lib/pacientes";
import {
  aplicarFiltros, filtrosAUrl, hayFiltros, leerFiltros, opcionesConConteo,
} from "@/lib/pacientes-filtros";
import { createClient } from "@/lib/supabase/server";
import { FiltrosPacientes } from "./filtros-pacientes";

export const metadata: Metadata = { title: "Pacientes" };

// Se muestran todos de una vez (la base tiene unos 550). 1.000 es el tope que
// devuelve Supabase por consulta: si algún día se supera, aparece la paginación.
const POR_PAGINA = 1000;

function Saldo({ porCobrar, prepagadas, corto }: { porCobrar: number; prepagadas: number; corto?: boolean }) {
  if (porCobrar === 0 && prepagadas === 0) return corto ? null : <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {porCobrar > 0 && <Badge variant="warning">{porCobrar} por cobrar</Badge>}
      {prepagadas > 0 && (
        <Badge variant="info">{prepagadas} {prepagadas === 1 ? "prepagada" : "prepagadas"}</Badge>
      )}
    </span>
  );
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Primero los conteos: de ahí salen las opciones (p. ej. los países que existen)
  // y contra ellas se valida lo que venga en la URL.
  const { data: facetas } = await supabase.from("pacientes_facetas").select("faceta, valor, total");
  const opciones = opcionesConConteo(facetas ?? []);
  const filtros = leerFiltros(sp, opciones);
  const totalBase = (facetas ?? []).filter((f) => f.faceta === "estado").reduce((n, f) => n + f.total, 0);

  const paginaCruda = Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina;
  const pagina = Math.max(1, Number(paginaCruda) || 1);

  const resultado = await aplicarFiltros(
    supabase
      .from("pacientes_listado")
      .select(
        "id, nombre_completo, tipo, estado, pais, telefono, no_contactar, ultima_sesion, sesiones_por_cobrar, sesiones_prepagadas",
        { count: "exact" },
      ),
    filtros,
  )
    .order("nombre_completo")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  const pacientes = resultado.data ?? [];
  const total = resultado.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrado = hayFiltros(filtros);
  const urlPagina = (n: number) => {
    const base = filtrosAUrl(filtros);
    return `${base}${base.includes("?") ? "&" : "?"}pagina=${n}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="titulo">Pacientes</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {filtrado
              ? `${total} de ${totalBase} pacientes`
              : `${total} ${total === 1 ? "paciente" : "pacientes"}`}
          </p>
        </div>
        <Link href="/pacientes/nuevo" className={buttonVariants()}>
          <Plus strokeWidth={2.2} /> Nuevo paciente
        </Link>
      </div>

      <FiltrosPacientes activos={filtros} opciones={opciones} />

      {resultado.error ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          No se pudieron cargar los pacientes. Recarga la página.
        </p>
      ) : pacientes.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Users}
            title="No hay pacientes con estos filtros"
            description="Quita algún filtro o limpia la búsqueda."
          />
        </div>
      ) : (
        <>
          {/* Escritorio: tabla. */}
          <div className="tabla-wrap hidden md:block">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Estado</th>
                  <th>Teléfono</th>
                  <th>País</th>
                  <th>Saldo</th>
                  <th>Última sesión</th>
                  <th className="w-10"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {pacientes.map((p) => (
                  <tr key={p.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <Iniciales nombre={p.nombre_completo} />
                        <div className="min-w-0">
                          <Link href={`/pacientes/${p.id}`} className="font-medium hover:underline">
                            {p.nombre_completo}
                          </Link>
                          {p.tipo !== "individual" && (
                            <p className="text-muted-foreground text-[0.8125rem]">{TIPO_LABEL[p.tipo]}</p>
                          )}
                          {p.no_contactar && (
                            <p className="text-destructive text-[0.8125rem] font-medium">No volver a contactar</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><Estado tono={ESTADO_TONO[p.estado]}>{ESTADO_LABEL[p.estado]}</Estado></td>
                    <td className="text-secondary-foreground whitespace-nowrap tabular-nums">{p.telefono ?? "—"}</td>
                    <td className="text-secondary-foreground">{p.pais ?? "—"}</td>
                    <td><Saldo porCobrar={p.sesiones_por_cobrar} prepagadas={p.sesiones_prepagadas} /></td>
                    <td className="text-secondary-foreground whitespace-nowrap">{formatearFecha(p.ultima_sesion)}</td>
                    <td className="pl-0!">
                      <Link
                        href={`/pacientes/${p.id}`} aria-label={`Abrir la ficha de ${p.nombre_completo}`} tabIndex={-1}
                        className="text-muted-foreground group-hover:text-foreground flex size-8 items-center justify-center"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: lista. */}
          <ul className="panel divide-border divide-y overflow-hidden md:hidden">
            {pacientes.map((p) => (
              <li key={p.id}>
                <Link href={`/pacientes/${p.id}`} className="active:bg-muted flex min-h-[4.25rem] items-center gap-3 px-4 py-2.5">
                  <Iniciales nombre={p.nombre_completo} className="size-10 text-[0.84rem]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nombre_completo}</span>
                    <Estado tono={ESTADO_TONO[p.estado]} className="text-secondary-foreground gap-1.5 text-[0.84rem]">
                      {ESTADO_LABEL[p.estado]}
                      {p.ultima_sesion && ` · ${formatearFecha(p.ultima_sesion)}`}
                    </Estado>
                    {p.no_contactar && (
                      <span className="text-destructive block text-[0.8125rem] font-medium">No volver a contactar</span>
                    )}
                  </span>
                  <Saldo porCobrar={p.sesiones_por_cobrar} prepagadas={p.sesiones_prepagadas} corto />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {paginas > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-muted-foreground">
            Página {pagina} de {paginas} · {total} pacientes en total
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link href={urlPagina(pagina - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Anterior
              </Link>
            )}
            {pagina < paginas && (
              <Link href={urlPagina(pagina + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
