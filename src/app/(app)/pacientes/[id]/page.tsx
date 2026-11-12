import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, ClipboardList, FileDown, Send, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { Iniciales } from "@/components/ui/iniciales";
import { Resumen } from "@/components/ui/resumen";
import { anioActual, formatearDinero, formatearFecha, hoyBogota } from "@/lib/fecha";
import {
  ESTADO_LABEL, ESTADO_TONO, MODALIDAD_LABEL, PLAN_TRABAJO_LABEL, TIPO_LABEL, textoRelacionEmergencia,
} from "@/lib/pacientes";
import { EMPRESA_LABEL, FACTURA_ESTADO_LABEL, FACTURA_ESTADO_TONO } from "@/lib/facturas/estados";
import { dinero } from "@/lib/facturas/tipos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { marcarFlyerEnviado } from "../actions";
import { RegistrarPaquete, RegistrarSesion, SesionesPanel } from "./sesiones-panel";

export const metadata: Metadata = { title: "Ficha del paciente" };

/** Un bloque del panel de datos: rótulo + pares etiqueta/valor. */
function Grupo({ titulo, children, pie }: { titulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <section className="border-border space-y-2.5 border-b px-5 py-[1.125rem] last:border-b-0">
      <h2 className="rotulo">{titulo}</h2>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[0.84rem]">{children}</dl>
      {pie}
    </section>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children ?? "—"}</dd>
    </>
  );
}

const siNo = (v: boolean) => (v ? "Sí" : "No");

export default async function FichaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const anio = anioActual();

  const { data: p } = await supabase.from("pacientes_listado").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: sesiones }, { data: tarifas }, { data: plan }, { data: facturas }] = await Promise.all([
    supabase.from("sesiones").select("*").eq("paciente_id", id).order("numero", { ascending: false }),
    supabase.from("paciente_tarifas").select("*").eq("paciente_id", id).in("anio", [anio, anio - 1]),
    p.plan_membresia_id
      ? supabase.from("planes_membresia").select("*").eq("id", p.plan_membresia_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("facturas_listado")
      .select("id, numero, fecha, emisor_clave, moneda, total, estado")
      .eq("paciente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const tarifa = (a: number) => {
    const t = (tarifas ?? []).find((x) => x.anio === a);
    return t ? formatearDinero(t.valor, t.moneda) : "—";
  };
  const hayEmergencia = p.emergencia_nombre || p.emergencia_telefono || p.emergencia_relacion;

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        <Link href="/pacientes" className="enlace">Pacientes</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{p.nombre_completo}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Iniciales nombre={p.nombre_completo} className="bg-brand text-brand-foreground size-13 text-lg md:size-15 md:text-xl" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="titulo">{p.nombre_completo}</h1>
            <div className="text-secondary-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm">
              <Estado tono={ESTADO_TONO[p.estado]} className="text-foreground font-medium">{ESTADO_LABEL[p.estado]}</Estado>
              {p.tipo !== "individual" && <span>{TIPO_LABEL[p.tipo]}</span>}
              {p.modalidad && <span>{MODALIDAD_LABEL[p.modalidad]}</span>}
              {p.es_miembro && <span>Miembro</span>}
              {p.no_contactar && <Badge variant="destructive"><Ban /> No volver a contactar</Badge>}
            </div>
          </div>
        </div>
        {/* En el móvil, «Registrar sesión» ocupa toda la fila y va primero. */}
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto">
          <Link href={`/historias/${id}`} className={buttonVariants({ variant: "outline" })}>
            <ClipboardList /> Historia clínica
          </Link>
          <Link href={`/pacientes/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
          <RegistrarPaquete pacienteId={id} />
          <RegistrarSesion
            pacienteId={id} nombre={p.nombre_completo} hoy={hoyBogota()} prepagadas={p.sesiones_prepagadas}
            className="order-first col-span-2 h-12 text-base sm:order-none sm:h-10 sm:text-sm"
          />
        </div>
      </header>

      <Resumen
        aria-label="Resumen de sesiones"
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        datos={[
          { titulo: "Realizadas", valor: p.sesiones_realizadas, detalle: "sesiones que ya tuvo" },
          {
            titulo: "Por cobrar", valor: p.sesiones_por_cobrar, detalle: "tenidas y sin pagar",
            tono: p.sesiones_por_cobrar > 0 ? "text-warning-foreground" : undefined,
          },
          {
            titulo: "Prepagadas", valor: p.sesiones_prepagadas, detalle: "pagadas, por tener",
            tono: p.sesiones_prepagadas > 0 ? "text-info-foreground" : undefined,
          },
          {
            titulo: "Perdidas", valor: p.sesiones_perdidas, detalle: "no asistió",
            tono: p.sesiones_perdidas > 0 ? "text-destructive" : undefined,
          },
          { titulo: `Valor ${anio}`, valor: tarifa(anio), detalle: "por sesión" },
        ]}
      />

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-9">
          <SesionesPanel pacienteId={id} sesiones={sesiones ?? []} />

          <section className="space-y-3.5" aria-labelledby="facturas-titulo">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="facturas-titulo" className="text-[1.1875rem] font-semibold tracking-[-0.01em]">Facturas</h2>
              <Link href={`/facturas/nueva?paciente=${id}`} className={buttonVariants({ variant: "brand", size: "sm" })}>
                Nueva factura
              </Link>
            </div>
            {(facturas ?? []).length === 0 ? (
              <p className="panel text-muted-foreground px-5 py-5 text-sm">Aún no se le ha emitido ninguna factura.</p>
            ) : (
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Fecha</th>
                      <th>Empresa</th>
                      <th className="text-right">Total</th>
                      <th>Estado</th>
                      <th className="w-12"><span className="sr-only">PDF</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(facturas ?? []).map((f) => (
                      <tr key={f.id} className={cn(f.estado === "anulada" && "text-muted-foreground")}>
                        <td>
                          <Link href={`/facturas/${f.id}`} className="font-mono text-[0.8125rem] whitespace-nowrap hover:underline">{f.numero}</Link>
                        </td>
                        <td className="text-secondary-foreground whitespace-nowrap">{formatearFecha(f.fecha)}</td>
                        <td className="text-secondary-foreground">{EMPRESA_LABEL[f.emisor_clave] ?? f.emisor_clave}</td>
                        <td className={cn("text-right whitespace-nowrap tabular-nums", f.estado === "anulada" && "line-through")}>
                          {dinero(Number(f.total), f.moneda)} <span className="text-muted-foreground text-xs">{f.moneda}</span>
                        </td>
                        <td><Estado tono={FACTURA_ESTADO_TONO[f.estado]}>{FACTURA_ESTADO_LABEL[f.estado]}</Estado></td>
                        <td className="py-1.5! pl-0! text-right">
                          <a
                            href={`/facturas/${f.id}/pdf?descargar=1`} title="Descargar PDF"
                            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                            aria-label={`Descargar el PDF de ${f.numero}`}
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
          </section>
        </div>

        {/* Los datos del paciente quedan siempre a la vista, al lado de las sesiones. */}
        <aside aria-label="Datos del paciente" className="panel w-full shrink-0 lg:w-80">
          <Grupo titulo="Contacto">
            <Dato label="Teléfono">
              {p.telefono && <a href={`tel:${p.telefono.replace(/[^\d+]/g, "")}`} className="enlace">{p.telefono}</a>}
            </Dato>
            <Dato label="Correo">{p.email && <a href={`mailto:${p.email}`} className="enlace">{p.email}</a>}</Dato>
            <Dato label="Documento">{p.documento}</Dato>
            <Dato label="País">{p.pais}</Dato>
            <Dato label="WhatsApp">{p.grupo_whatsapp ?? "Sin grupo"}</Dato>
          </Grupo>

          <Grupo
            titulo="Contacto de emergencia"
            pie={
              // Los pacientes que venían del Excel no traen este dato: se invita a completarlo.
              !hayEmergencia && (
                <Link
                  href={`/pacientes/${id}/editar#contacto-emergencia`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <UserPlus /> Agregar contacto
                </Link>
              )
            }
          >
            {hayEmergencia ? (
              <>
                <Dato label="Nombre">{p.emergencia_nombre}</Dato>
                <Dato label="Teléfono">
                  {p.emergencia_telefono && (
                    <a href={`tel:${p.emergencia_telefono.replace(/[^\d+]/g, "")}`} className="enlace">{p.emergencia_telefono}</a>
                  )}
                </Dato>
                <Dato label="Relación">
                  {textoRelacionEmergencia(p.emergencia_relacion, p.emergencia_relacion_otra)}
                </Dato>
              </>
            ) : (
              <dd className="text-muted-foreground col-span-2">Sin registrar.</dd>
            )}
          </Grupo>

          <Grupo titulo="Proceso terapéutico">
            <Dato label="Inicio">
              {p.fecha_inicio ? formatearFecha(p.fecha_inicio) : (p.fecha_inicio_texto ?? "—")}
            </Dato>
            <Dato label="Última sesión">{formatearFecha(p.ultima_sesion)}</Dato>
            <Dato label="Plan de trabajo">
              {p.plan_trabajo_enviado ? PLAN_TRABAJO_LABEL[p.plan_trabajo_enviado] : "—"}
            </Dato>
            <Dato label="Consentimiento">{p.consentimiento ? "Firmado" : "Sin firmar"}</Dato>
          </Grupo>

          <Grupo titulo="Valor de la consulta">
            <Dato label={`Valor ${anio}`}>{tarifa(anio)}</Dato>
            <Dato label={`Valor ${anio - 1}`}>{tarifa(anio - 1)}</Dato>
          </Grupo>

          <Grupo titulo="Membresía">
            <Dato label="Inscrito">{siNo(p.es_miembro)}</Dato>
            <Dato label="Invitación">{p.correo_membresia_enviado ? "Correo enviado" : "No enviada"}</Dato>
            <Dato label="Plan">
              {plan ? `${plan.nombre}${plan.periodicidad ? ` · ${plan.periodicidad}` : ""}` : "—"}
            </Dato>
          </Grupo>

          <Grupo
            titulo="Seguimiento"
            pie={
              !p.flyer_enviado && !p.no_contactar && (
                <form action={marcarFlyerEnviado.bind(null, id)}>
                  <Button type="submit" variant="outline" size="sm">
                    <Send /> Marcar flyer enviado hoy
                  </Button>
                </form>
              )
            }
          >
            <Dato label="Flyer">
              {p.flyer_enviado
                ? `Enviado${p.flyer_enviado_el ? ` · ${formatearFecha(p.flyer_enviado_el)}` : ""}`
                : "No enviado"}
            </Dato>
            {p.no_contactar && <Dato label="No contactar">{p.no_contactar_motivo ?? "Sí"}</Dato>}
          </Grupo>

          <section className="space-y-2 px-5 py-[1.125rem]">
            <h2 className="rotulo">Notas</h2>
            <p className="text-secondary-foreground text-[0.84rem] whitespace-pre-line">
              {p.notas ?? <span className="text-muted-foreground">Sin notas.</span>}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
