import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Moneda, SesionAsistencia, SesionPago } from "@/lib/database.types";

/** Lo que el formulario de «Nueva factura» necesita saber de un paciente. */
export type PacienteParaFacturar = {
  id: string;
  nombre: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  /** Valor de su consulta por año, del más reciente al más antiguo. */
  tarifas: { anio: number; valor: number; moneda: Moneda }[];
  /** Sesiones ya ocurridas que aún no están en ninguna factura, de la más reciente a la más antigua. */
  sesiones: {
    id: string;
    numero: number;
    fecha: string | null;
    asistencia: SesionAsistencia;
    pago: SesionPago;
    valor: number | null;
    moneda: Moneda | null;
  }[];
};

export async function pacienteParaFacturar(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<PacienteParaFacturar | null> {
  const [paciente, tarifas, sesiones] = await Promise.all([
    supabase.from("pacientes").select("id, nombre_completo, documento, email, telefono, pais").eq("id", id).maybeSingle(),
    supabase.from("paciente_tarifas").select("anio, valor, moneda").eq("paciente_id", id).order("anio", { ascending: false }),
    supabase
      .from("sesiones_por_facturar")
      .select("id, numero, fecha, asistencia, pago, valor, moneda")
      .eq("paciente_id", id)
      .order("numero", { ascending: false })
      .limit(60),
  ]);
  if (!paciente.data) return null;
  const p = paciente.data;
  return {
    id: p.id,
    nombre: p.nombre_completo,
    documento: p.documento,
    email: p.email,
    telefono: p.telefono,
    pais: p.pais,
    tarifas: (tarifas.data ?? []).map((t) => ({ ...t, valor: Number(t.valor) })),
    sesiones: (sesiones.data ?? []).map((s) => ({ ...s, valor: s.valor == null ? null : Number(s.valor) })),
  };
}
