import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatearFecha } from "@/lib/fecha";
import { ESTADO_BADGE, ESTADO_LABEL, TIPO_LABEL } from "@/lib/pacientes";
import {
  aplicarFiltros, filtrosAUrl, hayFiltros, leerFiltros, opcionesConConteo,
} from "@/lib/pacientes-filtros";
import { createClient } from "@/lib/supabase/server";
import { FiltrosPacientes } from "./filtros-pacientes";

export const metadata: Metadata = { title: "Pacientes" };

// Se muestran todos de una vez (la base tiene unos 550). 1.000 es el tope que
// devuelve Supabase por consulta: si algún día se supera, aparece la paginación.
const POR_PAGINA = 1000;

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
        "id, nombre_completo, tipo, estado, pais, telefono, grupo_whatsapp, es_miembro, no_contactar, ultima_sesion, sesiones_realizadas, sesiones_por_cobrar, sesiones_prepagadas",
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {filtrado
              ? `${total} de ${totalBase} pacientes`
              : `${total} ${total === 1 ? "paciente" : "pacientes"}`}
          </p>
        </div>
        <Link href="/pacientes/nuevo" className={buttonVariants()}>
          <Plus /> Nuevo paciente
        </Link>
      </div>

      <FiltrosPacientes activos={filtros} opciones={opciones} />

      {resultado.error ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          No se pudieron cargar los pacientes. Recarga la página.
        </p>
      ) : pacientes.length === 0 ? (
        <div className="tabla-wrap">
          <EmptyState
            icon={Users}
            title="No hay pacientes con estos filtros"
            description="Quita algún filtro o limpia la búsqueda."
          />
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Estado</th>
                <th>Grupo WhatsApp</th>
                <th>Membresía</th>
                <th>Última sesión</th>
                <th className="text-right">Sesiones</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pacientes/${p.id}`} className="hover:text-primary font-medium">
                      {p.nombre_completo}
                    </Link>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                      {p.tipo !== "individual" && <span>{TIPO_LABEL[p.tipo]}</span>}
                      {p.telefono && <span>{p.telefono}</span>}
                      {p.no_contactar && (
                        <span className="text-destructive inline-flex items-center gap-1">
                          <Ban className="size-3" /> No contactar
                        </span>
                      )}
                    </div>
                  </td>
                  <td><Badge variant={ESTADO_BADGE[p.estado]}>{ESTADO_LABEL[p.estado]}</Badge></td>
                  <td className="text-muted-foreground">{p.grupo_whatsapp ?? "—"}</td>
                  <td>{p.es_miembro ? <Badge variant="outline">Miembro</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-muted-foreground whitespace-nowrap">{formatearFecha(p.ultima_sesion)}</td>
                  <td className="text-right tabular-nums">{p.sesiones_realizadas}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {p.sesiones_por_cobrar > 0 && <Badge variant="warning">{p.sesiones_por_cobrar} por cobrar</Badge>}
                      {p.sesiones_prepagadas > 0 && (
                        <Badge variant="outline" className="border-info/40 text-info">
                          {p.sesiones_prepagadas} {p.sesiones_prepagadas === 1 ? "prepagada" : "prepagadas"}
                        </Badge>
                      )}
                      {p.sesiones_por_cobrar === 0 && p.sesiones_prepagadas === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
