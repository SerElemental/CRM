"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmentado } from "@/components/ui/segmentado";
import type { GrupoWhatsapp, Moneda, Paciente, PlanMembresia } from "@/lib/database.types";
import { ESTADOS, MODALIDADES, PLANES_TRABAJO, RELACIONES_EMERGENCIA, TIPOS } from "@/lib/pacientes";
import type { PacienteFormState } from "./actions";

type Tarifa = { valor: number; moneda: Moneda } | null;

/** Título y ayuda a la izquierda, campos a la derecha. Todas las secciones van en un solo panel. */
function Seccion({
  titulo, ayuda, id, children,
}: {
  titulo: string; ayuda?: string; id?: string; children: React.ReactNode;
}) {
  return (
    <fieldset id={id} className="border-border scroll-mt-6 border-b last:border-b-0">
      <legend className="sr-only">{titulo}</legend>
      <div className="grid gap-x-10 gap-y-4 px-5 py-6 md:px-7 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em]">{titulo}</h2>
          {ayuda && <p className="text-muted-foreground text-[0.8125rem]">{ayuda}</p>}
        </div>
        <div className="grid gap-x-5 gap-y-[1.125rem] sm:grid-cols-2">{children}</div>
      </div>
    </fieldset>
  );
}

function Campo({
  label, htmlFor, error, ancho, children,
}: {
  label: string; htmlFor: string; error?: string; ancho?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={ancho ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function Casilla({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-10 items-center gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="accent-primary size-[1.125rem]" />
      {label}
    </label>
  );
}

function CampoValor({
  anio, sufijo, valor, moneda, error,
}: {
  anio: number; sufijo: "actual" | "anterior"; valor: string | number; moneda: string | number; error?: string;
}) {
  return (
    <Campo label={`Valor ${anio}`} htmlFor={`valor_${sufijo}`} error={error}>
      <div className="flex gap-2">
        <Input
          id={`valor_${sufijo}`} name={`valor_${sufijo}`} inputMode="decimal"
          defaultValue={valor} placeholder="Ej. 93000" aria-invalid={error ? true : undefined}
        />
        <select
          name={`moneda_${sufijo}`} defaultValue={moneda}
          className="control w-24 shrink-0" aria-label={`Moneda del valor ${anio}`}
        >
          <option value="COP">COP</option>
          <option value="USD">USD</option>
        </select>
      </div>
    </Campo>
  );
}

/** Sección aparte porque el campo «¿Cuál?» solo aparece al elegir la relación «Otro». */
function ContactoEmergencia({
  nombre, telefono, relacion: relacionInicial, relacionOtra, errorOtra,
}: {
  nombre: string | number; telefono: string | number; relacion: string;
  relacionOtra: string | number; errorOtra?: string;
}) {
  const [relacion, setRelacion] = useState(relacionInicial);
  return (
    <Seccion titulo="Contacto de emergencia" id="contacto-emergencia" ayuda="A quién llamar si pasa algo durante el proceso.">
      <Campo label="Nombre del contacto" htmlFor="emergencia_nombre">
        <Input id="emergencia_nombre" name="emergencia_nombre" defaultValue={nombre} />
      </Campo>
      <Campo label="Teléfono del contacto" htmlFor="emergencia_telefono">
        <Input id="emergencia_telefono" name="emergencia_telefono" type="tel" defaultValue={telefono} />
      </Campo>
      <Campo label="Relación con el paciente" htmlFor="emergencia_relacion">
        <select
          id="emergencia_relacion" name="emergencia_relacion" className="control"
          value={relacion} onChange={(ev) => setRelacion(ev.target.value)}
        >
          <option value="">Sin definir</option>
          {RELACIONES_EMERGENCIA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Campo>
      {relacion === "otro" && (
        <Campo label="¿Cuál es la relación?" htmlFor="emergencia_relacion_otra" error={errorOtra}>
          <Input
            id="emergencia_relacion_otra" name="emergencia_relacion_otra" defaultValue={relacionOtra}
            placeholder="Ej. hermana, tío, amiga" aria-invalid={errorOtra ? true : undefined} autoFocus
          />
        </Campo>
      )}
    </Seccion>
  );
}

export function PacienteForm({
  action, paciente, grupos, planes, anio, tarifaActual, tarifaAnterior, cancelarHref,
}: {
  action: (prev: PacienteFormState, formData: FormData) => Promise<PacienteFormState>;
  paciente?: Paciente;
  grupos: GrupoWhatsapp[];
  planes: PlanMembresia[];
  anio: number;
  tarifaActual: Tarifa;
  tarifaAnterior: Tarifa;
  cancelarHref: string;
}) {
  const [state, formAction, pendiente] = useActionState(action, undefined);
  const e = state?.campos ?? {};
  const p = paciente;
  // React vacía el formulario al terminar la acción. Si hubo un error, se vuelve a
  // montar (`key`) con lo que la persona había escrito, para que no lo pierda.
  const v = state?.valores;
  const txt = (campo: string, inicial: string | number | null | undefined) =>
    v ? (v[campo] ?? "") : (inicial ?? "");
  const chk = (campo: string, inicial: boolean | undefined) => (v ? v[campo] === "on" : inicial);

  return (
    <form key={state?.intento ?? 0} action={formAction} className="space-y-5">
      <div className="panel">
      <Seccion titulo="Datos del paciente" ayuda="Lo básico para identificarlo y escribirle.">
        <Campo label="Nombre completo" htmlFor="nombre_completo" error={e.nombre_completo} ancho>
          <Input id="nombre_completo" name="nombre_completo" defaultValue={txt("nombre_completo", p?.nombre_completo)} required />
        </Campo>
        <div className="space-y-1.5 sm:col-span-2">
          <Label id="tipo-rotulo">Tipo de paciente</Label>
          <Segmentado
            name="tipo" aria-labelledby="tipo-rotulo" opciones={TIPOS}
            defaultValue={String(txt("tipo", p?.tipo ?? "individual"))} className="max-sm:grid-cols-2!"
          />
        </div>
        <Campo label="Documento de identidad" htmlFor="documento">
          <Input id="documento" name="documento" defaultValue={txt("documento", p?.documento)} placeholder="Ej. C.C. 1.234.567" />
        </Campo>
        <Campo label="País" htmlFor="pais">
          <Input id="pais" name="pais" defaultValue={txt("pais", p?.pais ?? "Colombia")} />
        </Campo>
        <Campo label="Teléfono" htmlFor="telefono">
          <Input id="telefono" name="telefono" type="tel" defaultValue={txt("telefono", p?.telefono ?? "")} />
        </Campo>
        <Campo label="Correo" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" defaultValue={txt("email", p?.email ?? "")} />
        </Campo>
        <Campo label="Grupo de WhatsApp" htmlFor="grupo_whatsapp_id">
          <select id="grupo_whatsapp_id" name="grupo_whatsapp_id" defaultValue={txt("grupo_whatsapp_id", p?.grupo_whatsapp_id ?? "")} className="control">
            <option value="">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </Campo>
      </Seccion>

      <ContactoEmergencia
        nombre={txt("emergencia_nombre", p?.emergencia_nombre)}
        telefono={txt("emergencia_telefono", p?.emergencia_telefono)}
        relacion={String(txt("emergencia_relacion", p?.emergencia_relacion))}
        relacionOtra={txt("emergencia_relacion_otra", p?.emergencia_relacion_otra)}
        errorOtra={e.emergencia_relacion_otra}
      />

      <Seccion titulo="Proceso terapéutico" ayuda="Estado, modalidad y documentos del proceso.">
        <Campo label="Estado" htmlFor="estado">
          <select id="estado" name="estado" defaultValue={txt("estado", p?.estado ?? "activo")} className="control">
            {ESTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Campo>
        <div className="space-y-1.5">
          <Label id="modalidad-rotulo">Modalidad</Label>
          <Segmentado
            name="modalidad" aria-labelledby="modalidad-rotulo"
            opciones={[{ value: "", label: "Sin definir" }, ...MODALIDADES]}
            defaultValue={String(txt("modalidad", p?.modalidad ?? ""))}
          />
        </div>
        <Campo label="Fecha de inicio" htmlFor="fecha_inicio" error={e.fecha_inicio}>
          <Input id="fecha_inicio" name="fecha_inicio" type="date" defaultValue={txt("fecha_inicio", p?.fecha_inicio ?? "")} />
          {p?.fecha_inicio_texto && !p.fecha_inicio && (
            <p className="text-muted-foreground text-xs">En el Excel: «{p.fecha_inicio_texto}»</p>
          )}
        </Campo>
        <div className="space-y-1.5">
          <Label id="plan-rotulo">Plan de trabajo enviado</Label>
          <Segmentado
            name="plan_trabajo_enviado" aria-labelledby="plan-rotulo"
            opciones={[{ value: "", label: "Sin definir" }, ...PLANES_TRABAJO]}
            defaultValue={String(txt("plan_trabajo_enviado", p?.plan_trabajo_enviado ?? ""))}
          />
        </div>
        <div className="sm:col-span-2">
          <Casilla name="consentimiento" label="Consentimiento firmado" defaultChecked={chk("consentimiento", p?.consentimiento)} />
        </div>
      </Seccion>

      <Seccion titulo="Valor de la consulta" ayuda="Es el valor que se propone al facturar. Cada año tiene el suyo.">
        <CampoValor
          anio={anio} sufijo="actual" error={e.valor_actual}
          valor={txt("valor_actual", tarifaActual?.valor)} moneda={txt("moneda_actual", tarifaActual?.moneda ?? "COP")}
        />
        <CampoValor
          anio={anio - 1} sufijo="anterior" error={e.valor_anterior}
          valor={txt("valor_anterior", tarifaAnterior?.valor)} moneda={txt("moneda_anterior", tarifaAnterior?.moneda ?? "COP")}
        />
      </Seccion>

      <Seccion titulo="Membresía">
        <Casilla name="es_miembro" label="Inscrito en la membresía" defaultChecked={chk("es_miembro", p?.es_miembro)} />
        <Casilla name="correo_membresia_enviado" label="Correo de invitación enviado" defaultChecked={chk("correo_membresia_enviado", p?.correo_membresia_enviado)} />
        <Campo label="Plan de membresía" htmlFor="plan_membresia_id">
          <select id="plan_membresia_id" name="plan_membresia_id" defaultValue={txt("plan_membresia_id", p?.plan_membresia_id ?? "")} className="control">
            <option value="">Sin plan</option>
            {planes.map((pl) => <option key={pl.id} value={pl.id}>{pl.nombre}</option>)}
          </select>
        </Campo>
      </Seccion>

      <Seccion titulo="Seguimiento" ayuda="Flyer, contacto y notas internas.">
        <Casilla name="flyer_enviado" label="Flyer de seguimiento enviado" defaultChecked={chk("flyer_enviado", p?.flyer_enviado)} />
        <Campo label="Fecha de envío del flyer" htmlFor="flyer_enviado_el" error={e.flyer_enviado_el}>
          <Input id="flyer_enviado_el" name="flyer_enviado_el" type="date" defaultValue={txt("flyer_enviado_el", p?.flyer_enviado_el ?? "")} />
        </Campo>
        <Casilla name="no_contactar" label="No volver a contactar" defaultChecked={chk("no_contactar", p?.no_contactar)} />
        <Campo label="Motivo" htmlFor="no_contactar_motivo">
          <Input id="no_contactar_motivo" name="no_contactar_motivo" defaultValue={txt("no_contactar_motivo", p?.no_contactar_motivo ?? "")} />
        </Campo>
        <Campo label="Notas" htmlFor="notas" ancho>
          <textarea id="notas" name="notas" rows={4} defaultValue={txt("notas", p?.notas ?? "")} className="control" />
        </Campo>
      </Seccion>
      </div>

      {state?.error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          {state.error}
        </p>
      )}

      {/* Fija abajo: se puede guardar sin recorrer todo el formulario. En el móvil queda sobre la navegación. */}
      <div className="panel border-input sticky bottom-[4.75rem] z-20 flex justify-end gap-2.5 px-4 py-3 shadow-md md:bottom-4">
        <Link href={cancelarHref} className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
        <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar paciente"}</Button>
      </div>
    </form>
  );
}
