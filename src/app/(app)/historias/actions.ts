"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { ObjetivoEstado } from "@/lib/database.types";
import { hoyBogota } from "@/lib/fecha";
import type { CampoSeccion } from "@/lib/historias";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_ADJUNTO, TIPOS_ADJUNTO, adendaSchema, identificacionSchema, notaSchema, objetivoSchema, seccionSchema,
  type DatosNota,
} from "@/lib/validations/historia";

export type HistoriaState = { ok?: true; error?: string } | undefined;

const primerError = (r: { error: { issues: { message: string }[] } }) => r.error.issues[0]?.message ?? "Datos inválidos.";

function refrescar(pacienteId: string) {
  revalidatePath(`/historias/${pacienteId}`);
  revalidatePath("/historias");
}

/** Abre la historia de un paciente (si ya la tiene, solo entra). */
export async function abrirHistoria(pacienteId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { data: existe } = await supabase.from("historias").select("paciente_id").eq("paciente_id", pacienteId).maybeSingle();
  if (!existe) {
    const { error } = await supabase.from("historias").insert({ paciente_id: pacienteId });
    if (error) redirect(`/pacientes/${pacienteId}?historia=error`);
    refrescar(pacienteId);
    revalidatePath(`/pacientes/${pacienteId}`);
  }
  redirect(`/historias/${pacienteId}`);
}

/**
 * Guarda una sección de texto. La llama el autoguardado mientras se escribe
 * (`final = false`, sin refrescar la pantalla) y el botón «Listo» (`final = true`).
 */
export async function guardarSeccion(
  datos: { paciente_id: string; campo: string; texto: string }, final: boolean,
): Promise<HistoriaState> {
  await requireProfile();
  const r = seccionSchema.safeParse(datos);
  if (!r.success) return { error: primerError(r) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("historias")
    .update({ [r.data.campo]: r.data.texto } as Partial<Record<CampoSeccion, string | null>>)
    .eq("paciente_id", r.data.paciente_id)
    .select("paciente_id")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo guardar. Intenta de nuevo." };
  if (final) refrescar(r.data.paciente_id);
  return { ok: true };
}

export async function guardarIdentificacion(_prev: HistoriaState, formData: FormData): Promise<HistoriaState> {
  await requireProfile();
  const r = identificacionSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: primerError(r) };
  const { paciente_id, documento, ...historia } = r.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("historias")
    // Con una fecha de consulta exacta ya no hace falta el texto original del Word.
    .update({ ...historia, ...(historia.fecha_consulta ? { fecha_consulta_texto: null } : {}) })
    .eq("paciente_id", paciente_id);
  if (error) return { error: "No se pudieron guardar los datos. Intenta de nuevo." };

  // El documento es un dato de la ficha del paciente (también lo usan las facturas).
  const { error: e2 } = await supabase.from("pacientes").update({ documento }).eq("id", paciente_id);
  if (e2) return { error: "Se guardó todo menos el documento. Intenta de nuevo." };

  refrescar(paciente_id);
  revalidatePath(`/historias/importar/${paciente_id}`);
  revalidatePath(`/pacientes/${paciente_id}`);
  return { ok: true };
}

// ───────────────────────── Notas de sesión ─────────────────────────

/** Crea la nota de la siguiente sesión, en borrador, y abre el editor. */
export async function crearNota(pacienteId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("crear_nota", { p_paciente: pacienteId, p_fecha: hoyBogota() });
  if (error || !id) redirect(`/historias/${pacienteId}?vista=evolucion&error=nota`);
  refrescar(pacienteId);
  redirect(`/historias/${pacienteId}/notas/${id}`);
}

async function escribirNota(datos: DatosNota) {
  const supabase = await createClient();
  const { id, paciente_id, ...resto } = datos;
  const { data, error } = await supabase
    .from("historia_notas")
    .update(resto)
    .eq("id", id)
    .eq("paciente_id", paciente_id)
    .eq("estado", "borrador")
    .select("id")
    .maybeSingle();
  return { supabase, guardada: !error && Boolean(data) };
}

/** Autoguardado del editor. Solo escribe sobre borradores. */
export async function guardarNota(datos: DatosNota): Promise<HistoriaState> {
  await requireProfile();
  const r = notaSchema.safeParse(datos);
  if (!r.success) return { error: primerError(r) };
  const { guardada } = await escribirNota(r.data);
  if (!guardada) return { error: "No se pudo guardar la nota. Si ya está firmada, no admite cambios." };
  return { ok: true };
}

/** «Guardar borrador y salir». */
export async function guardarNotaYSalir(datos: DatosNota): Promise<HistoriaState> {
  const r = await guardarNota(datos);
  if (r?.error) return r;
  refrescar(datos.paciente_id);
  redirect(`/historias/${datos.paciente_id}?vista=evolucion`);
}

/**
 * Firma la nota: queda bloqueada. `registro` dice qué hacer con la ficha del
 * paciente: enlazar la sesión que ya existe en esa fecha, registrar una nueva
 * (pagada o sin pagar) o no tocarla.
 */
export async function firmarNota(
  datos: DatosNota, registro: "pagada" | "sin_pagar" | "ninguno",
): Promise<HistoriaState> {
  await requireProfile();
  const r = notaSchema.safeParse(datos);
  if (!r.success) return { error: primerError(r) };
  const d = r.data;
  if (!d.fecha) return { error: "Escribe la fecha de la sesión antes de firmar." };
  if (!Object.values(d.campos).some((t) => t.trim())) {
    return { error: "La nota está vacía: escribe el registro de la sesión antes de firmar." };
  }

  const { supabase, guardada } = await escribirNota(d);
  if (!guardada) return { error: "No se pudo guardar la nota antes de firmarla." };

  // Si la sesión de ese día ya está en la ficha y no tiene nota, se enlaza en vez de duplicarla.
  const [{ data: delDia }, { data: enlazadas }] = await Promise.all([
    supabase.from("sesiones").select("id").eq("paciente_id", d.paciente_id).eq("fecha", d.fecha)
      .eq("asistencia", "realizada").order("numero"),
    supabase.from("historia_notas").select("sesion_id").eq("paciente_id", d.paciente_id).not("sesion_id", "is", null),
  ]);
  const usadas = new Set((enlazadas ?? []).map((n) => n.sesion_id));
  const libre = (delDia ?? []).find((s) => !usadas.has(s.id));
  if (libre) {
    const { error } = await supabase.from("historia_notas").update({ sesion_id: libre.id }).eq("id", d.id);
    if (error) return { error: "No se pudo enlazar la sesión de la ficha. Intenta de nuevo." };
  }

  const { error } = await supabase.rpc("firmar_nota", {
    p_nota: d.id,
    p_pago: libre || registro === "ninguno" ? null : registro,
  });
  if (error) return { error: "No se pudo firmar la nota. Intenta de nuevo." };

  refrescar(d.paciente_id);
  revalidatePath(`/pacientes/${d.paciente_id}`);
  revalidatePath("/pacientes");
  revalidatePath("/inicio");
  redirect(`/historias/${d.paciente_id}?vista=evolucion`);
}

export async function eliminarBorrador(pacienteId: string, notaId: string): Promise<HistoriaState> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("historia_notas").delete().eq("id", notaId).eq("paciente_id", pacienteId).eq("estado", "borrador");
  if (error) return { error: "No se pudo eliminar el borrador." };
  refrescar(pacienteId);
  redirect(`/historias/${pacienteId}?vista=evolucion`);
}

export async function agregarAdenda(formData: FormData): Promise<HistoriaState> {
  await requireProfile();
  const r = adendaSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: primerError(r) };

  const supabase = await createClient();
  const { error } = await supabase.from("historia_adendas").insert({ nota_id: r.data.nota_id, texto: r.data.texto });
  if (error) return { error: "No se pudo guardar la adenda. Intenta de nuevo." };
  refrescar(r.data.paciente_id);
  return { ok: true };
}

// ───────────────────────── Plan de trabajo ─────────────────────────

export async function agregarObjetivo(formData: FormData): Promise<HistoriaState> {
  await requireProfile();
  const r = objetivoSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: primerError(r) };

  const supabase = await createClient();
  const { data: ultimo } = await supabase
    .from("historia_objetivos").select("orden").eq("paciente_id", r.data.paciente_id)
    .order("orden", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase
    .from("historia_objetivos")
    .insert({ paciente_id: r.data.paciente_id, nombre: r.data.nombre, orden: (ultimo?.orden ?? 0) + 1 });
  if (error) return { error: "No se pudo agregar el objetivo. Intenta de nuevo." };
  refrescar(r.data.paciente_id);
  return { ok: true };
}

export async function cambiarObjetivo(pacienteId: string, objetivoId: string, estado: ObjetivoEstado): Promise<HistoriaState> {
  await requireProfile();
  if (!["pendiente", "en_curso", "trabajado"].includes(estado)) return { error: "Estado inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("historia_objetivos").update({ estado }).eq("id", objetivoId).eq("paciente_id", pacienteId);
  if (error) return { error: "No se pudo cambiar el objetivo." };
  refrescar(pacienteId);
  return { ok: true };
}

// ───────────────────────── Adjuntos ─────────────────────────

export async function subirAdjunto(formData: FormData): Promise<HistoriaState> {
  await requireProfile();
  const pacienteId = String(formData.get("paciente_id") ?? "");
  const archivo = formData.get("archivo");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(pacienteId)) return { error: "Paciente inválido." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo." };
  if (archivo.size > MAX_ADJUNTO) return { error: "El archivo pesa más de 4 MB. Redúcelo y vuelve a subirlo." };
  if (!TIPOS_ADJUNTO.includes(archivo.type)) return { error: "Solo se aceptan PDF, imágenes (PNG, JPG, WebP) o Word." };

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  const ruta = `${pacienteId}/${randomUUID()}.${extension || "bin"}`;

  const supabase = await createClient();
  const { error: e1 } = await supabase.storage.from("historias").upload(ruta, archivo, { contentType: archivo.type });
  if (e1) return { error: "No se pudo subir el archivo. Intenta de nuevo." };

  const { error: e2 } = await supabase.from("historia_adjuntos").insert({
    paciente_id: pacienteId, nombre: nombre || archivo.name, ruta, tipo: archivo.type, tamano: archivo.size,
  });
  if (e2) return { error: "El archivo se subió, pero no quedó registrado en la historia. Intenta de nuevo." };
  refrescar(pacienteId);
  return { ok: true };
}

// ───────────────────────── Revisión de lo importado ─────────────────────────

/** Corrige la fecha de una sesión importada (mientras la historia siga en revisión). */
export async function guardarFechaNota(pacienteId: string, notaId: string, fecha: string): Promise<HistoriaState> {
  await requireProfile();
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("historia_notas").update({ fecha: fecha || null })
    .eq("id", notaId).eq("paciente_id", pacienteId).eq("estado", "borrador")
    .select("id").maybeSingle();
  if (error || !data) return { error: "No se pudo guardar la fecha." };
  return { ok: true };
}

/** Documento y fecha de consulta: los dos datos que casi nunca vienen completos en el Word. */
export async function guardarDatosRevision(
  pacienteId: string, datos: { documento: string; fecha_consulta: string },
): Promise<HistoriaState> {
  await requireProfile();
  const fecha = datos.fecha_consulta.trim();
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida." };
  const documento = datos.documento.trim().slice(0, 60) || null;

  const supabase = await createClient();
  const { error: e1 } = await supabase.from("pacientes").update({ documento }).eq("id", pacienteId);
  if (e1) return { error: "No se pudo guardar el documento." };
  if (fecha) {
    const { error: e2 } = await supabase
      .from("historias").update({ fecha_consulta: fecha, fecha_consulta_texto: null }).eq("paciente_id", pacienteId);
    if (e2) return { error: "No se pudo guardar la fecha de consulta." };
  }
  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}

/** Confirma la revisión: las notas importadas quedan firmadas y se pasa a la siguiente historia. */
export async function confirmarImportacion(pacienteId: string): Promise<HistoriaState> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_importacion", { p_paciente: pacienteId });
  if (error) return { error: "No se pudo confirmar la revisión. Intenta de nuevo." };
  refrescar(pacienteId);
  revalidatePath("/historias/importar");

  const { data: siguiente } = await supabase
    .from("historias_listado").select("paciente_id").eq("estado", "por_revisar")
    .order("nombre_completo").limit(1).maybeSingle();
  redirect(siguiente ? `/historias/importar/${siguiente.paciente_id}` : "/historias/importar");
}
