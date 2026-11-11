import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, ChevronLeft, Pencil, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { anioActual, formatearDinero, formatearFecha, hoyBogota } from "@/lib/fecha";
import {
  ESTADO_BADGE, ESTADO_LABEL, MODALIDAD_LABEL, PLAN_TRABAJO_LABEL, TIPO_LABEL, textoRelacionEmergencia,
} from "@/lib/pacientes";
import { createClient } from "@/lib/supabase/server";
import { marcarFlyerEnviado } from "../actions";
import { SesionesPanel } from "./sesiones-panel";

export const metadata: Metadata = { title: "Ficha del paciente" };

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-card ring-foreground/[0.06] rounded-xl p-5 shadow-sm ring-1">
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
      <dl className="space-y-2.5 text-sm">{children}</dl>
    </section>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children ?? "—"}</dd>
    </div>
  );
}

const siNo = (v: boolean) => (v ? "Sí" : "No");

export default async function FichaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const anio = anioActual();

  const { data: p } = await supabase.from("pacientes_listado").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: sesiones }, { data: tarifas }, { data: plan }] = await Promise.all([
    supabase.from("sesiones").select("*").eq("paciente_id", id).order("numero", { ascending: false }),
    supabase.from("paciente_tarifas").select("*").eq("paciente_id", id).in("anio", [anio, anio - 1]),
    p.plan_membresia_id
      ? supabase.from("planes_membresia").select("*").eq("id", p.plan_membresia_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const tarifa = (a: number) => {
    const t = (tarifas ?? []).find((x) => x.anio === a);
    return t ? formatearDinero(t.valor, t.moneda) : "—";
  };

  return (
    <div className="space-y-6">
      <Link href="/pacientes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" /> Pacientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{p.nombre_completo}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={ESTADO_BADGE[p.estado]}>{ESTADO_LABEL[p.estado]}</Badge>
            {p.tipo !== "individual" && <Badge variant="outline">{TIPO_LABEL[p.tipo]}</Badge>}
            {p.modalidad && <Badge variant="outline">{MODALIDAD_LABEL[p.modalidad]}</Badge>}
            {p.es_miembro && <Badge>Miembro</Badge>}
            {p.no_contactar && (
              <Badge variant="destructive"><Ban /> No volver a contactar</Badge>
            )}
          </div>
        </div>
        <Link href={`/pacientes/${id}/editar`} className={buttonVariants({ variant: "outline" })}>
          <Pencil /> Editar
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tarjeta titulo="Contacto">
          <Dato label="Teléfono">{p.telefono}</Dato>
          <Dato label="Correo">{p.email}</Dato>
          <Dato label="País">{p.pais}</Dato>
          <Dato label="Grupo de WhatsApp">{p.grupo_whatsapp ?? "Sin grupo"}</Dato>
        </Tarjeta>

        <Tarjeta titulo="Contacto de emergencia">
          <Dato label="Nombre">{p.emergencia_nombre}</Dato>
          <Dato label="Teléfono">{p.emergencia_telefono}</Dato>
          <Dato label="Relación">
            {textoRelacionEmergencia(p.emergencia_relacion, p.emergencia_relacion_otra)}
          </Dato>
        </Tarjeta>

        <Tarjeta titulo="Proceso terapéutico">
          <Dato label="Fecha de inicio">
            {p.fecha_inicio ? formatearFecha(p.fecha_inicio) : (p.fecha_inicio_texto ?? "—")}
          </Dato>
          <Dato label="Última sesión">{formatearFecha(p.ultima_sesion)}</Dato>
          <Dato label="Plan de trabajo enviado">
            {p.plan_trabajo_enviado ? PLAN_TRABAJO_LABEL[p.plan_trabajo_enviado] : "—"}
          </Dato>
          <Dato label="Consentimiento">{siNo(p.consentimiento)}</Dato>
        </Tarjeta>

        <Tarjeta titulo="Valor de la consulta">
          <Dato label={`Valor ${anio}`}>{tarifa(anio)}</Dato>
          <Dato label={`Valor ${anio - 1}`}>{tarifa(anio - 1)}</Dato>
        </Tarjeta>

        <Tarjeta titulo="Membresía">
          <Dato label="Inscrito">{siNo(p.es_miembro)}</Dato>
          <Dato label="Correo de invitación">{p.correo_membresia_enviado ? "Enviado" : "No enviado"}</Dato>
          <Dato label="Plan">
            {plan ? `${plan.nombre}${plan.periodicidad ? ` · ${plan.periodicidad}` : ""}` : "—"}
          </Dato>
        </Tarjeta>

        <Tarjeta titulo="Seguimiento">
          <Dato label="Flyer de seguimiento">
            {p.flyer_enviado
              ? `Enviado${p.flyer_enviado_el ? ` · ${formatearFecha(p.flyer_enviado_el)}` : ""}`
              : "No enviado"}
          </Dato>
          {p.no_contactar && <Dato label="No contactar">{p.no_contactar_motivo ?? "Sí"}</Dato>}
          {!p.flyer_enviado && !p.no_contactar && (
            <form action={marcarFlyerEnviado.bind(null, id)} className="pt-1">
              <Button type="submit" variant="outline" size="sm">
                <Send /> Marcar flyer enviado hoy
              </Button>
            </form>
          )}
        </Tarjeta>

        {/* Séptima tarjeta: ocupa la fila entera para no quedar suelta. */}
        <section className="bg-card ring-foreground/[0.06] rounded-xl p-5 shadow-sm ring-1 md:col-span-2 xl:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">Notas</h2>
          <p className="text-sm whitespace-pre-line">
            {p.notas ?? <span className="text-muted-foreground">Sin notas.</span>}
          </p>
        </section>
      </div>

      <SesionesPanel
        pacienteId={id}
        sesiones={sesiones ?? []}
        hoy={hoyBogota()}
        resumen={{
          realizadas: p.sesiones_realizadas,
          porCobrar: p.sesiones_por_cobrar,
          prepagadas: p.sesiones_prepagadas,
          perdidas: p.sesiones_perdidas,
        }}
      />
    </div>
  );
}
