import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import { EMPRESA_LABEL, FACTURA_ESTADO_BADGE, FACTURA_ESTADO_LABEL } from "@/lib/facturas/estados";
import { facturaADatos } from "@/lib/facturas/esquema";
import { dinero } from "@/lib/facturas/tipos";
import { createClient } from "@/lib/supabase/server";
import { AccionesFactura } from "./acciones-factura";

export const metadata: Metadata = { title: "Factura" };

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children ?? "—"}</dd>
    </div>
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
    <div className="space-y-5">
      <Link href="/facturas" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" /> Facturas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{datos.emisor.nombreDocumento}</p>
          <h1 className="text-2xl font-semibold tracking-tight tabular-nums">{f.numero}</h1>
          <Badge variant={FACTURA_ESTADO_BADGE[f.estado]}>{FACTURA_ESTADO_LABEL[f.estado]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AccionesFactura id={id} numero={f.numero} estado={f.estado} pacienteId={f.paciente_id} hoy={hoyBogota()} />
          <a href={`${pdf}?descargar=1`} className={buttonVariants({ variant: "outline" })}>
            <FileDown /> Descargar PDF
          </a>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <section className="bg-card ring-foreground/[0.06] h-fit rounded-xl p-5 shadow-sm ring-1">
          <dl className="space-y-2.5 text-sm">
            <Dato label="Total">
              <span className="font-semibold tabular-nums">{dinero(Number(f.total), f.moneda)}</span>{" "}
              <span className="text-muted-foreground text-xs">{f.moneda}</span>
            </Dato>
            <Dato label="Fecha de emisión">{formatearFecha(f.fecha)}</Dato>
            <Dato label="Empresa">{EMPRESA_LABEL[f.emisor_clave] ?? f.emisor_clave} · {datos.emisor.razonSocial}</Dato>
            <Dato label="A nombre de">{datos.cliente.nombre}</Dato>
            {datos.cliente.identificacion && <Dato label="Identificación">{datos.cliente.identificacion}</Dato>}
            <Dato label="Paciente">
              {paciente ? (
                <Link href={`/pacientes/${paciente.id}`} className="hover:text-primary underline underline-offset-2">
                  {paciente.nombre_completo}
                </Link>
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
        </section>

        <section className="space-y-2">
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
            <iframe src={pdf} title={`PDF de ${f.numero}`} className="h-[78vh] min-h-[32rem] w-full" />
          </div>
          <a href={pdf} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
            <ExternalLink className="size-3" /> Abrir el PDF en otra pestaña
          </a>
        </section>
      </div>
    </div>
  );
}
