import type { Sesion, SesionAsistencia, SesionPago } from "@/lib/database.types";

export const ASISTENCIA_LABEL: Record<SesionAsistencia, string> = {
  realizada: "Realizada",
  pendiente: "Pendiente",
  perdida: "Perdida",
};

export const PAGO_LABEL: Record<SesionPago, string> = {
  pagada: "Pagada",
  paquete: "Paquete",
  sin_pagar: "Sin pagar",
  no_aplica: "—",
};

/**
 * Los cinco estados que se ven en la tira de puntos y en la leyenda. Es la
 * misma información del Excel (color + letra), pero con un nombre para cada caso.
 */
export type EstadoVisual = "pagada" | "paquete" | "sin_pagar" | "prepagada" | "perdida";

export function estadoVisual(s: Pick<Sesion, "asistencia" | "pago">): EstadoVisual {
  if (s.asistencia === "perdida") return "perdida";
  if (s.asistencia === "pendiente") return "prepagada";
  if (s.pago === "sin_pagar") return "sin_pagar";
  if (s.pago === "paquete") return "paquete";
  return "pagada";
}

export const ESTADO_VISUAL: Record<EstadoVisual, { label: string; punto: string }> = {
  pagada: { label: "Realizada y pagada", punto: "bg-success" },
  paquete: { label: "Realizada (paquete)", punto: "bg-info" },
  sin_pagar: { label: "Realizada, sin pagar", punto: "bg-warning" },
  prepagada: { label: "Prepagada, por tener", punto: "border-2 border-info bg-transparent" },
  perdida: { label: "Perdida", punto: "bg-destructive" },
};
