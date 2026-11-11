import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, Plus, ReceiptText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Estado } from "@/components/ui/estado";
import { Resumen } from "@/components/ui/resumen";
import type { FacturaEstado } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import {
  EMPRESA_LABEL, FACTURA_ESTADO_LABEL, FACTURA_ESTADO_TONO, FACTURA_ESTADOS, rangoDelMes,
} from "@/lib/facturas/estados";
import { dinero, fechaLarga } from "@/lib/facturas/tipos";
import { normalizarBusqueda } from "@/lib/pacientes-filtros";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FiltrosFacturas, type FiltrosFactura } from "./filtros-facturas";

export const metadata: Metadata = { title: "Facturas" };

const LIMITE = 500;

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const supabase = await createClient();

  const { data: emisores } = await supabase.from("emisores").select("clave").eq("activo", true).order("orden");
  const empresas = (emisores ?? []).map((e) => e.clave);

  // Solo se aceptan valores conocidos; lo demás se ignora.
  const filtros: FiltrosFactura = {
    q: uno(sp.q).trim().slice(0, 100),
    mes: rangoDelMes(uno(sp.mes)) ? uno(sp.mes) : "",
    empresa: empresas.includes(uno(sp.empresa)) ? uno(sp.empresa) : "",
    estado: FACTURA_ESTADOS.some((e) => e.value === uno(sp.estado)) ? uno(sp.estado) : "",
  };
  const rango = rangoDelMes(filtros.mes);
  const busqueda = normalizarBusqueda(filtros.q).replace(/[\\%_]/g, "\\$&");
  const estado = (filtros.estado || null) as FacturaEstado | null;

  let consulta = supabase
    .from("facturas_listado")
    .select("id, numero, fecha, emisor_clave, paciente_id, moneda, total, estado, cliente_nombre, paciente_nombre", { count: "exact" });
  if (rango) consulta = consulta.gte("fecha", rango.desde).lte("fecha", rango.hasta);
  if (filtros.empresa) consulta = consulta.eq("emisor_clave", filtros.empresa);
  if (estado) consulta = consulta.eq("estado", estado);
  if (busqueda) consulta = consulta.ilike("busqueda", `%${busqueda}%`);

  const [resultado, totales] = await Promise.all([
    consulta.order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(LIMITE),
    supabase.rpc("facturas_totales", {
      p_desde: rango?.desde ?? null,
      p_hasta: rango?.hasta ?? null,
      p_emisor: filtros.empresa || null,
      p_estado: estado,
      p_busqueda: busqueda || null,
    }),
  ]);

  const facturas = resultado.data ?? [];
  const total = resultado.count ?? 0;
  const sumas = [...(totales.data ?? [])].sort((a, b) => a.moneda.localeCompare(b.moneda));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="titulo">Facturas</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {total} {total === 1 ? "documento" : "documentos"}
            {rango && ` · ${fechaLarga(rango.desde, "es").replace(/^1 de /, "")}`}
          </p>
        </div>
        <Link href="/facturas/nueva" className={buttonVariants()}>
          <Plus strokeWidth={2.2} /> Nueva factura
        </Link>
      </div>

      <FiltrosFacturas activos={filtros} empresas={empresas} />

      {sumas.length > 0 && (
        <Resumen
          aria-label="Totales"
          className={sumas.length > 1 ? "sm:grid-cols-2" : undefined}
          datos={sumas.map((s) => ({
            titulo: `Total en ${s.moneda}${estado ? ` · ${FACTURA_ESTADO_LABEL[estado].toLowerCase()}s` : ""}`,
            valor: dinero(Number(s.total), s.moneda),
            detalle: `${s.cantidad} ${s.cantidad === 1 ? "documento" : "documentos"}${estado ? "" : " · sin contar anuladas"}`,
          }))}
        />
      )}

      {resultado.error ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          No se pudieron cargar las facturas. Recarga la página.
        </p>
      ) : facturas.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={ReceiptText}
            title={filtros.q || filtros.mes || filtros.empresa || filtros.estado ? "No hay facturas con estos filtros" : "Aún no hay facturas"}
            description="Cada factura que emitas queda guardada aquí y en la ficha del paciente."
            action={<Link href="/facturas/nueva" className={buttonVariants({ variant: "outline", size: "sm" })}>Nueva factura</Link>}
          />
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>A nombre de</th>
                <th>Empresa</th>
                <th className="text-right">Total</th>
                <th>Estado</th>
                <th className="w-12"><span className="sr-only">PDF</span></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id} className={cn(f.estado === "anulada" && "text-muted-foreground")}>
                  <td>
                    <Link href={`/facturas/${f.id}`} className="font-mono text-[0.8125rem] whitespace-nowrap hover:underline">
                      {f.numero}
                    </Link>
                  </td>
                  <td className="text-secondary-foreground whitespace-nowrap">{formatearFecha(f.fecha)}</td>
                  <td>
                    <span className="font-medium">{f.cliente_nombre}</span>
                    {f.paciente_id && f.paciente_nombre && f.paciente_nombre !== f.cliente_nombre && (
                      <div className="text-muted-foreground text-[0.8125rem]">
                        Paciente:{" "}
                        <Link href={`/pacientes/${f.paciente_id}`} className="enlace">
                          {f.paciente_nombre}
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="text-secondary-foreground">{EMPRESA_LABEL[f.emisor_clave] ?? f.emisor_clave}</td>
                  <td className={cn("text-right whitespace-nowrap tabular-nums", f.estado === "anulada" && "line-through")}>
                    {dinero(Number(f.total), f.moneda)} <span className="text-muted-foreground text-xs">{f.moneda}</span>
                  </td>
                  <td><Estado tono={FACTURA_ESTADO_TONO[f.estado]}>{FACTURA_ESTADO_LABEL[f.estado]}</Estado></td>
                  <td className="py-1.5! pl-0! text-right">
                    <a
                      href={`/facturas/${f.id}/pdf?descargar=1`}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                      aria-label={`Descargar el PDF de ${f.numero}`} title="Descargar PDF"
                    >
                      <FileDown />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > facturas.length && (
        <p className="text-muted-foreground text-[0.8125rem]">
          Se muestran las {facturas.length} más recientes de {total}. Usa el mes o la búsqueda para ver las demás.
        </p>
      )}
    </div>
  );
}
