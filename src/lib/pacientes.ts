import type {
  Modalidad, PacienteEstado, PacienteTipo, PlanTrabajo, RelacionEmergencia,
} from "@/lib/database.types";
import type { Tono } from "@/lib/tono";

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

/** Relación del contacto de emergencia con el paciente. Con «otro» se escribe cuál. */
export const RELACIONES_EMERGENCIA: { value: RelacionEmergencia; label: string }[] = [
  { value: "mama", label: "Mamá" },
  { value: "papa", label: "Papá" },
  { value: "esposo", label: "Esposo/a" },
  { value: "hijo", label: "Hijo/a" },
  { value: "otro", label: "Otro" },
];

const etiqueta = <T extends string>(lista: { value: T; label: string }[]) =>
  Object.fromEntries(lista.map((o) => [o.value, o.label])) as Record<T, string>;

export const ESTADO_LABEL = etiqueta(ESTADOS);
export const TIPO_LABEL = etiqueta(TIPOS);
export const MODALIDAD_LABEL = etiqueta(MODALIDADES);
export const PLAN_TRABAJO_LABEL = etiqueta(PLANES_TRABAJO);
export const RELACION_EMERGENCIA_LABEL = etiqueta(RELACIONES_EMERGENCIA);

/** «Mamá», «Esposo/a»… o lo que se escribió cuando la relación es «otro». */
export function textoRelacionEmergencia(
  relacion: RelacionEmergencia | null,
  otra: string | null,
): string | null {
  if (!relacion) return null;
  return relacion === "otro" ? (otra ?? "Otro") : RELACION_EMERGENCIA_LABEL[relacion];
}

/** Tono del punto que acompaña a cada estado. */
export const ESTADO_TONO: Record<PacienteEstado, Tono> = {
  activo: "success",
  seguimiento: "warning",
  inactivo: "neutral",
  inactivo_sin_pagar: "danger",
  remitido: "outline",
};