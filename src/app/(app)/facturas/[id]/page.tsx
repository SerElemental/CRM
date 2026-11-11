import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import { EMPRESA_LABEL, FACTURA_ESTADO_LABEL, FACTURA_ESTADO_TONO } from "@/lib/facturas/estados";
import { facturaADatos } from "@/lib/facturas/esquema";
import { dinero } from "@/lib/facturas/tipos";
import { createClient } from "@/lib/supabase/server";
import { AccionesFactura } from "./acciones-factura";

export const metadata: Metadata = { title: "Factura" };

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children ?? "—"}</dd>
    </>
  );
}

export default async function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: f } = await supabase.from("facturas").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();

  const datos = facturaADatos(f);
  const [{ data: paciente }, { count: sesiones }] = await Promise.all([
    f.paciente_id
      ? supabase.from("pacientes").select("id, nombre_completo").eq("id", f.paciente_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("factura_sesiones").select("sesion_id", { count: "exact", head: true }).eq("factura_id", id),
  ]);
  const pdf = `/facturas/${id}/pdf`;

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        <Link href="/facturas" className="enlace">Facturas</Link>
        <span aria-hidden>/</span>
        <span>{f.numero}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-1.5">
          <p className="rotulo">{datos.emisor.nombreDocumento}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="titulo tabular-nums">{f.numero}</h1>
            <Estado tono={FACTURA_ESTADO_TONO[f.estado]} className="border-border bg-card h-7 rounded-[5px] border px-2.5 text-[0.8125rem] font-medium">
              {FACTURA_ESTADO_LABEL[f.estado]}{f.estado === "emitida" && " · pendiente de pago"}
            </Estado>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a href={`${pdf}?descargar=1`} className={buttonVariants({ variant: "outline" })}>
            <FileDown /> Descargar PDF
          </a>
          <AccionesFactura id={id} numero={f.numero} estado={f.estado} pacienteId={f.paciente_id} hoy={hoyBogota()} />
        </div>
      </header>

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <aside aria-label="Datos de la factura" className="panel w-full shrink-0 lg:w-80">
          <div className="border-border space-y-1 border-b px-5 py-5">
            <p className="rotulo">Total</p>
            <p className="text-[2rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums">
              <span className={f.estado === "anulada" ? "text-muted-foreground line-through" : undefined}>
                {dinero(Number(f.total), f.moneda)}
              </span>{" "}
              <span className="text-muted-foreground text-sm font-normal tracking-normal">{f.moneda}</span>
            </p>
          </div>
          <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-5 py-5 text-[0.84rem]">
            <Dato label="Fecha de emisión">{formatearFecha(f.fecha)}</Dato>
            <Dato label="Empresa">{EMPRESA_LABEL[f.emisor_clave] ?? f.emisor_clave} · {datos.emisor.razonSocial}</Dato>
            <Dato label="A nombre de">{datos.cliente.nombre}</Dato>
            {datos.cliente.identificacion && <Dato label="Identificación">{datos.cliente.identificacion}</Dato>}
            <Dato label="Paciente">
              {paciente ? (
                <Link href={`/pacientes/${paciente.id}`} className="enlace">{paciente.nombre_completo}</Link>
              ) : "No es de un paciente"}
            </Dato>
            {(sesiones ?? 0) > 0 && <Dato label="Sesiones que cubre">{sesiones}</Dato>}
            {f.estado === "pagada" && <Dato label="Pagada el">{formatearFecha(f.pagada_el)}</Dato>}
            {f.estado === "anulada" && (
              <>
                <Dato label="Anulada el">{formatearFecha(f.anulada_el)}</Dato>
                <Dato label="Motivo">{f.anulada_motivo}</Dato>
              </>
            )}
            {f.notas && <Dato label="Observaciones">{f.notas}</Dato>}
          </dl>
          {f.estado === "emitida" && (sesiones ?? 0) > 0 && (
            <p className="text-muted-foreground border-border border-t px-5 py-4 text-[0.8125rem]">
              Al marcarla como pagada, las sesiones que cubre quedan pagadas en la ficha.
            </p>
          )}
        </aside>

        <section aria-label="Documento" className="min-w-0 flex-1 space-y-2.5">
          <div className="border-input bg-card overflow-hidden rounded-sm border">
            <iframe src={pdf} title={`PDF de ${f.numero}`} className="h-[78vh] min-h-[32rem] w-full" />
          </div>
          <a href={pdf} target="_blank" rel="noreferrer" className="enlace inline-flex items-center gap-1.5 text-[0.8125rem]">
            <ExternalLink className="size-3.5" /> Abrir el PDF en otra pestaña
          </a>
        </section>
      </div>
    </div>
  );
}
