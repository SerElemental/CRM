"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { facturaNuevaSchema, itemsParaGuardar } from "@/lib/facturas/esquema";
import { createClient } from "@/lib/supabase/server";

export type FacturaState = { ok?: true; error?: string } | undefined;

/** Los mensajes que lanzan las funciones de la base ya vienen en español y son para la persona. */
const mensaje = (e: { message: string; code?: string }, porDefecto: string) =>
  e.code === "P0001" ? e.message : porDefecto;

function refrescar(facturaId?: string, pacienteId?: string | null) {
  revalidatePath("/facturas");
  if (facturaId) revalidatePath(`/facturas/${facturaId}`);
  if (pacienteId) revalidatePath(`/pacientes/${pacienteId}`);
}

export async function emitirFactura(_prev: FacturaState, formData: FormData): Promise<FacturaState> {
  await requireProfile();

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return { error: "No se pudieron leer los datos del formulario." };
  }
  const r = facturaNuevaSchema.safeParse(crudo);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisa los datos de la factura." };
  const d = r.data;

  const sesiones = [...new Set(d.items.map((i) => i.sesionId).filter((s): s is string => Boolean(s)))];
  if (sesiones.length && !d.pacienteId) {
    return { error: "Para facturar sesiones hay que elegir el paciente." };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("emitir_factura", {
    p_emisor: d.emisor,
    p_paciente: d.pacienteId,
    p_fecha: d.fecha,
    p_cliente: d.cliente,
    p_items: itemsParaGuardar(d.items),
    p_notas: d.notas,
    p_sesiones: sesiones,
  });
  if (error || !id) return { error: error ? mensaje(error, "No se pudo emitir la factura.") : "No se pudo emitir la factura." };

  refrescar(id, d.pacienteId);
  redirect(`/facturas/${id}`);
}

const idSchema = z.uuid();

export async function marcarFacturaPagada(id: string, pacienteId: string | null, formData: FormData) {
  await requireProfile();
  if (!idSchema.safeParse(id).success) return;
  const fecha = String(formData.get("fecha") ?? "");
  const supabase = await createClient();
  await supabase.rpc("marcar_factura_pagada", {
    p_factura: id,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? { p_fecha: fecha } : {}),
  });
  refrescar(id, pacienteId);
}

export async function reabrirFactura(id: string, pacienteId: string | null) {
  await requireProfile();
  if (!idSchema.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.rpc("reabrir_factura", { p_factura: id });
  refrescar(id, pacienteId);
}

export async function anularFactura(
  id: string, pacienteId: string | null, _prev: FacturaState, formData: FormData,
): Promise<FacturaState> {
  await requireProfile();
  if (!idSchema.safeParse(id).success) return { error: "Factura inválida." };
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribe el motivo de la anulación." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_factura", { p_factura: id, p_motivo: motivo });
  if (error) return { error: mensaje(error, "No se pudo anular la factura.") };
  refrescar(id, pacienteId);
  return { ok: true };
}
