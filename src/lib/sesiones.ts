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
 * Los cuatro estados que se ven en la tira de casillas y en la leyenda. Es la
 * misma información del Excel (color + letra), pero con un nombre para cada caso.
 * Una sesión efectuada que salió de un paquete ya está pagada: se ve igual que
 * cualquier otra pagada (en el Excel, amarillo con o sin letra).
 */
export type EstadoVisual = "pagada" | "sin_pagar" | "prepagada" | "perdida";

export function estadoVisual(s: Pick<Sesion, "asistencia" | "pago">): EstadoVisual {
  if (s.asistencia === "perdida") return "perdida";
  if (s.asistencia === "pendiente") return "prepagada";
  if (s.pago === "sin_pagar") return "sin_pagar";
  return "pagada";
}

/**
 * `casilla` pinta el cuadro numerado de cada sesión. Los estados se distinguen
 * también por claridad y por el borde (lleno, claro, punteado, solo contorno),
 * no solo por el color.
 */
export const ESTADO_VISUAL: Record<EstadoVisual, { label: string; casilla: string }> = {
  pagada: { label: "Realizada y pagada", casilla: "border-success bg-success text-white" },
  sin_pagar: { label: "Realizada, sin pagar", casilla: "border-warning bg-warning/30 text-foreground" },
  prepagada: { label: "Prepagada, por tener", casilla: "border-dashed border-info bg-card text-info-foreground" },
  perdida: { label: "Perdida", casilla: "border-destructive bg-card text-destructive" },
};
