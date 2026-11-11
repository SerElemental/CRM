import type { Modalidad, PacienteEstado, PacienteTipo, PlanTrabajo } from "@/lib/database.types";

export const ESTADOS: { value: PacienteEstado; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "inactivo", label: "Inactivo" },
  { value: "inactivo_sin_pagar", label: "Inactivo sin pagar" },
  { value: "remitido", label: "Remitido" },
];

export const TIPOS: { value: PacienteTipo; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "pareja", label: "Pareja" },
  { value: "adolescente", label: "Adolescente" },
  { value: "nino", label: "Niño" },
];

export const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "presencial", label: "Presencial" },
];

export const PLANES_TRABAJO: { value: PlanTrabajo; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_aplica", label: "No aplica" },
];

const etiqueta = <T extends string>(lista: { value: T; label: string }[]) =>
  Object.fromEntries(lista.map((o) => [o.value, o.label])) as Record<T, string>;

export const ESTADO_LABEL = etiqueta(ESTADOS);
export const TIPO_LABEL = etiqueta(TIPOS);
export const MODALIDAD_LABEL = etiqueta(MODALIDADES);
export const PLAN_TRABAJO_LABEL = etiqueta(PLANES_TRABAJO);

/** Variante del <Badge> para cada estado. */
export const ESTADO_BADGE: Record<PacienteEstado, "success" | "warning" | "secondary" | "destructive" | "outline"> = {
  activo: "success",
  seguimiento: "warning",
  inactivo: "secondary",
  inactivo_sin_pagar: "destructive",
  remitido: "outline",
};

/** Texto de búsqueda como lo guarda la base: minúsculas y sin tildes. */
export function normalizarBusqueda(q: string): string {
  return q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
