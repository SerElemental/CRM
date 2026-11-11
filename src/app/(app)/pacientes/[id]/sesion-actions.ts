"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { paqueteSchema, sesionEditarSchema, sesionNuevaSchema } from "@/lib/validations/paciente";

export type SesionState = { ok?: true; error?: string } | undefined;

function refrescar(pacienteId: string) {
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/pacientes");
}

export async function registrarSesion(formData: FormData): Promise<SesionState> {
  await requireProfile();
  const r = sesionNuevaSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const d = r.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_sesion", {
    p_paciente: d.paciente_id,
    p_fecha: d.fecha,
    p_asistencia: d.asistencia,
    // Una sesión perdida sin paquete no genera cobro por sí sola (la multa va en la nota).
    p_pago: d.asistencia === "perdida" && d.pago === "pagada" ? "no_aplica" : d.pago,
    p_nota: d.nota,
  });
  if (error) return { error: "No se pudo registrar la sesión. Intenta de nuevo." };
  refrescar(d.paciente_id);
  return { ok: true };
}

export async function registrarPaquete(formData: FormData): Promise<SesionState> {
  await requireProfile();
  const r = paqueteSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_paquete", {
    p_paciente: r.data.paciente_id,
    p_cantidad: r.data.cantidad,
    p_nota: r.data.nota,
  });
  if (error) return { error: "No se pudo registrar el paquete. Intenta de nuevo." };
  refrescar(r.data.paciente_id);
  return { ok: true };
}

export async function editarSesion(formData: FormData): Promise<SesionState> {
  await requireProfile();
  const r = sesionEditarSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const d = r.data;
  if (d.asistencia === "pendiente" && d.pago !== "paquete") {
    return { error: "Una sesión pendiente solo puede ser prepagada (paquete)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sesiones")
    .update({
      fecha: d.asistencia === "pendiente" ? null : d.fecha,
      asistencia: d.asistencia,
      pago: d.pago,
      nota: d.nota,
    })
    .eq("id", d.id)
    .eq("paciente_id", d.paciente_id);
  if (error) return { error: "No se pudo guardar la sesión. Intenta de nuevo." };
  refrescar(d.paciente_id);
  return { ok: true };
}

/** Sesión que estaba sin pagar → pagada. */
export async function cobrarSesion(pacienteId: string, sesionId: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("sesiones")
    .update({ pago: "pagada" })
    .eq("id", sesionId)
    .eq("paciente_id", pacienteId)
    .eq("pago", "sin_pagar");
  refrescar(pacienteId);
}

export async function eliminarSesion(pacienteId: string, sesionId: string): Promise<SesionState> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("sesiones").delete().eq("id", sesionId).eq("paciente_id", pacienteId);
  if (error) return { error: "No se pudo eliminar la sesión." };
  refrescar(pacienteId);
  return { ok: true };
}
