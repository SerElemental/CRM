import { anioActual } from "@/lib/fecha";
import { createClient } from "@/lib/supabase/server";

/** Catálogos y tarifas que necesita el formulario de paciente (alta y edición). */
export async function datosFormulario(pacienteId?: string) {
  const supabase = await createClient();
  const anio = anioActual();
  const [grupos, planes, tarifas] = await Promise.all([
    supabase.from("grupos_whatsapp").select("*").eq("activo", true).order("id"),
    supabase.from("planes_membresia").select("*").eq("activo", true).order("precio"),
    pacienteId
      ? supabase.from("paciente_tarifas").select("*").eq("paciente_id", pacienteId).in("anio", [anio, anio - 1])
      : Promise.resolve({ data: [] }),
  ]);
  const de = (a: number) => (tarifas.data ?? []).find((t) => t.anio === a) ?? null;
  return {
    anio,
    grupos: grupos.data ?? [],
    planes: planes.data ?? [],
    tarifaActual: de(anio),
    tarifaAnterior: de(anio - 1),
  };
}
