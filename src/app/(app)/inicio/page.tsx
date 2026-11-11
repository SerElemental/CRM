import type { Metadata } from "next";
import Link from "next/link";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Iniciales } from "@/components/ui/iniciales";
import { Resumen } from "@/components/ui/resumen";
import { requireProfile } from "@/lib/auth";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import { rangoDelMes } from "@/lib/facturas/estados";
import { dinero } from "@/lib/facturas/tipos";
import { createClient } from "@/lib/supabase/server";
import { marcarFlyerEnviado } from "../pacientes/actions";
import { BuscadorRapido } from "./buscador-rapido";

export const metadata: Metadata = { title: "Inicio" };

const fmtDia = new Intl.DateTimeFormat("es-CO", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const fmtMes = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" });

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground border-border border-t px-5 py-5 text-sm md:px-6">{children}</p>;
}

/** Lo que hay que atender hoy: saldos por cobrar, seguimientos y facturas sin pagar. */
export default async function InicioPage() {
  const perfil = await requireProfile();
  const supabase = await createClient();

  const hoy = hoyBogota();
  const fecha = new Date(`${hoy}T00:00:00Z`);
  const mes = rangoDelMes(hoy.slice(0, 7))!;
  const dia = fmtDia.format(fecha);

  // Todos los números salen contados de la base (`count`), no de sumar filas aquí.
  const [facetas, sinPagar, cobrar, seguimiento, facturas, pendientes, realizadasMes, perdidasMes] = await Promise.all([
    supabase.from("pacientes_facetas").select("faceta, valor, total").in("faceta", ["estado", "saldo"]),
    supabase.from("sesiones").select("id", { count: "exact", head: true }).eq("pago", "sin_pagar"),
    supabase
      .from("pacientes_listado")
      .select("id, nombre_completo, ultima_sesion, sesiones_por_cobrar", { count: "exact" })
      .gt("sesiones_por_cobrar", 0)
      .order("ultima_sesion", { ascending: false, nullsFirst: false })
      .limit(6),
    supabase
      .from("pacientes_listado")
      .select("id, nombre_completo, ultima_sesion", { count: "exact" })
      .eq("estado", "seguimiento")
      .eq("flyer_enviado", false)
      .eq("no_contactar", false)
      .order("ultima_sesion", { ascending: false, nullsFirst: false })
      .limit(4),
    supabase
      .from("facturas_listado")
      .select("id, numero, fecha, moneda, total, cliente_nombre", { count: "exact" })
      .eq("estado", "emitida")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.rpc("facturas_totales", { p_estado: "emitida" }),
    supabase
      .from("sesiones").select("id", { count: "exact", head: true })
      .eq("asistencia", "realizada").gte("fecha", mes.desde).lte("fecha", mes.hasta),
    supabase
      .from("sesiones").select("id", { count: "exact", head: true })
      .eq("asistencia", "perdida").gte("fecha", mes.desde).lte("fecha", mes.hasta),
  ]);

  const faceta = (clave: string, valor: string) =>
    (facetas.data ?? []).find((f) => f.faceta === clave && f.valor === valor)?.total ?? 0;
  const conSaldo = faceta("saldo", "por_cobrar");
  const enSeguimiento = faceta("estado", "seguimiento");
  const sumas = [...(pendientes.data ?? [])].sort((a, b) => a.moneda.localeCompare(b.moneda));
  const perdidas = perdidasMes.count ?? 0;
  const nombre = perfil.nombre?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{dia.charAt(0).toUpperCase() + dia.slice(1)}</p>
          <h1 className="titulo">{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
          <div className="w-full sm:w-80"><BuscadorRapido /></div>
          <Link href="/facturas/nueva" className={buttonVariants({ variant: "brand" })}>Nueva factura</Link>
          <Link href="/pacientes/nuevo" className={buttonVariants()}>Nuevo paciente</Link>
        </div>
      </header>

      <Resumen
        aria-label="Resumen"
        className="sm:grid-cols-2 lg:grid-cols-4"
        datos={[
          {
            titulo: "Pacientes activos",
            valor: faceta("estado", "activo"),
            detalle: `${enSeguimiento} más en seguimiento`,
          },
          {
            titulo: "Sesiones por cobrar",
            valor: sinPagar.count ?? 0,
            detalle: conSaldo === 1 ? "de 1 paciente" : `de ${conSaldo} pacientes`,
            tono: (sinPagar.count ?? 0) > 0 ? "text-warning-foreground" : undefined,
          },
          {
            titulo: "Facturado sin pagar",
            valor: sumas[0] ? dinero(Number(sumas[0].total), sumas[0].moneda) : "$0",
            detalle: sumas[0]
              ? [sumas[0].moneda, ...sumas.slice(1).map((s) => `más ${dinero(Number(s.total), s.moneda)} ${s.moneda}`)].join(" · ")
              : "Ninguna factura pendiente",
          },
          {
            titulo: `Sesiones en ${fmtMes.format(fecha)}`,
            valor: realizadasMes.count ?? 0,
            detalle: perdidas === 1 ? "1 perdida" : `${perdidas} perdidas`,
          },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <section aria-labelledby="in-cobrar" className="panel lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-[1.125rem] pb-3.5 md:px-6">
            <h2 id="in-cobrar" className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Por cobrar</h2>
            {(cobrar.count ?? 0) > (cobrar.data ?? []).length && (
              <Link href="/pacientes?saldo=por_cobrar" className="enlace text-[0.8125rem]">
                Ver los {cobrar.count} pacientes
              </Link>
            )}
          </div>
          {(cobrar.data ?? []).length === 0 ? (
            <Vacio>Nadie tiene sesiones por cobrar.</Vacio>
          ) : (
            <ul>
              {(cobrar.data ?? []).map((p) => (
                <li key={p.id} className="border-border flex items-center gap-3.5 border-t px-5 py-2.5 md:px-6">
                  <Iniciales nombre={p.nombre_completo} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/pacientes/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                      {p.nombre_completo}
                    </Link>
                    <p className="text-muted-foreground text-[0.8125rem]">Última sesión · {formatearFecha(p.ultima_sesion)}</p>
                  </div>
                  <Badge variant="warning" className="hidden sm:inline-flex">{p.sesiones_por_cobrar} por cobrar</Badge>
                  <Badge variant="warning" className="sm:hidden">{p.sesiones_por_cobrar}</Badge>
                  <Link href={`/facturas/nueva?paciente=${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Facturar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="in-seg" className="panel">
            <div className="px-5 pt-[1.125rem] pb-3.5 md:px-6">
              <h2 id="in-seg" className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Seguimiento pendiente</h2>
              <p className="text-muted-foreground text-[0.8125rem]">En seguimiento y sin flyer enviado</p>
            </div>
            {(seguimiento.data ?? []).length === 0 ? (
              <Vacio>No hay flyers por enviar.</Vacio>
            ) : (
              <ul>
                {(seguimiento.data ?? []).map((p) => (
                  <li key={p.id} className="border-border flex items-center gap-3 border-t px-5 py-2.5 md:px-6">
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                        {p.nombre_completo}
                      </Link>
                      <p className="text-muted-foreground text-[0.8125rem]">Última sesión · {formatearFecha(p.ultima_sesion)}</p>
                    </div>
                    <form action={marcarFlyerEnviado.bind(null, p.id)}>
                      <Button type="submit" variant="outline" size="sm"><Send /> Flyer enviado</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {(seguimiento.count ?? 0) > (seguimiento.data ?? []).length && (
              <p className="border-border border-t px-5 py-3 md:px-6">
                <Link href="/pacientes?estado=seguimiento&flyer=no" className="enlace text-[0.8125rem]">
                  Ver los {seguimiento.count}
                </Link>
              </p>
            )}
          </section>

          <section aria-labelledby="in-fac" className="panel">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-[1.125rem] pb-3.5 md:px-6">
              <h2 id="in-fac" className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Facturas sin pagar</h2>
              {(facturas.count ?? 0) > 0 && (
                <Link href="/facturas?estado=emitida" className="enlace text-[0.8125rem]">
                  {(facturas.count ?? 0) > (facturas.data ?? []).length ? `Ver las ${facturas.count}` : "Ver todas"}
                </Link>
              )}
            </div>
            {(facturas.data ?? []).length === 0 ? (
              <Vacio>Todas las facturas emitidas están pagadas.</Vacio>
            ) : (
              <ul>
                {(facturas.data ?? []).map((f) => (
                  <li key={f.id} className="border-border flex items-center gap-3 border-t px-5 py-2.5 md:px-6">
                    <div className="min-w-0 flex-1">
                      <Link href={`/facturas/${f.id}`} className="font-mono text-[0.8125rem] hover:underline">{f.numero}</Link>
                      <p className="text-muted-foreground truncate text-[0.8125rem]">
                        {f.cliente_nombre} · {formatearFecha(f.fecha)}
                      </p>
                    </div>
                    <p className="text-sm font-medium whitespace-nowrap tabular-nums">
                      {dinero(Number(f.total), f.moneda)}{" "}
                      <span className="text-muted-foreground text-xs font-normal">{f.moneda}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
