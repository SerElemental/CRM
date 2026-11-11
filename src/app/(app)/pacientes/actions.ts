"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { anioActual, hoyBogota } from "@/lib/fecha";
import { createClient } from "@/lib/supabase/server";
import { pacienteSchema } from "@/lib/validations/paciente";

export type PacienteFormState =
  | {
      error: string;
      campos?: Record<string, string>;
      /** Lo que se envió, para volver a pintar el formulario sin perder nada. */
      valores: Record<string, string>;
      intento: number;
    }
  | undefined;

async function guardar(id: string | null, formData: FormData): Promise<PacienteFormState> {
  await requireProfile();

  const valores: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) valores[k] = v;
  const fallo = (error: string, campos?: Record<string, string>): PacienteFormState => ({
    error, campos, valores, intento: Date.now(),
  });

  const r = pacienteSchema.safeParse(valores);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const i of r.error.issues) campos[String(i.path[0])] ??= i.message;
    return fallo("Revisa los campos marcados.", campos);
  }
  const { valor_actual, moneda_actual, valor_anterior, moneda_anterior, ...d } = r.data;

  const fila = {
    ...d,
    flyer_enviado_el: d.flyer_enviado ? (d.flyer_enviado_el ?? hoyBogota()) : null,
    no_contactar_motivo: d.no_contactar ? d.no_contactar_motivo : null,
    plan_membresia_id: d.es_miembro ? d.plan_membresia_id : null,
    emergencia_relacion_otra: d.emergencia_relacion === "otro" ? d.emergencia_relacion_otra : null,
  };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("pacientes").update(fila).eq("id", id).select("id").maybeSingle()
    : await supabase.from("pacientes").insert(fila).select("id").single();
  if (error || !data) return fallo("No se pudo guardar el paciente. Intenta de nuevo.");

  // Tarifas: un valor vacío borra la del año; un valor la crea o la actualiza.
  const anio = anioActual();
  for (const t of [
    { anio, valor: valor_actual, moneda: moneda_actual },
    { anio: anio - 1, valor: valor_anterior, moneda: moneda_anterior },
  ]) {
    const { error: e } =
      t.valor == null
        ? await supabase.from("paciente_tarifas").delete().eq("paciente_id", data.id).eq("anio", t.anio)
        : await supabase
            .from("paciente_tarifas")
            .upsert({ paciente_id: data.id, anio: t.anio, valor: t.valor, moneda: t.moneda });
    if (e) {
      // En un alta el paciente ya existe: se sigue en su edición para no crearlo dos veces.
      if (!id) redirect(`/pacientes/${data.id}/editar`);
      return fallo("El paciente se guardó, pero no el valor de la consulta. Intenta de nuevo.");
    }
  }

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${data.id}`);
  redirect(`/pacientes/${data.id}`);
}

export async function crearPaciente(_prev: PacienteFormState, formData: FormData) {
  return guardar(null, formData);
}

export async function actualizarPaciente(id: string, _prev: PacienteFormState, formData: FormData) {
  return guardar(id, formData);
}

/** Acción rápida de la ficha: deja registrado que hoy se envió el flyer de seguimiento. */
export async function marcarFlyerEnviado(id: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("pacientes")
    .update({ flyer_enviado: true, flyer_enviado_el: hoyBogota() })
    .eq("id", id);
  revalidatePath(`/pacientes/${id}`);
  revalidatePath("/pacientes");
}
