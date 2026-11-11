import type { FacturaEstado } from "@/lib/database.types";

export const FACTURA_ESTADOS: { value: FacturaEstado; label: string }[] = [
  { value: "emitida", label: "Emitida" },
  { value: "pagada", label: "Pagada" },
  { value: "anulada", label: "Anulada" },
];

export const FACTURA_ESTADO_LABEL: Record<FacturaEstado, string> = {
  emitida: "Emitida",
  pagada: "Pagada",
  anulada: "Anulada",
};

/** Variante del <Badge>. «Emitida» = pendiente de pago. */
export const FACTURA_ESTADO_BADGE: Record<FacturaEstado, "warning" | "success" | "secondary"> = {
  emitida: "warning",
  pagada: "success",
  anulada: "secondary",
};

/** Nombre corto de cada empresa, por su clave. */
export const EMPRESA_LABEL: Record<string, string> = { co: "Colombia", us: "EE. UU." };

/** `2026-11` → primer y último día del mes. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } | null {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const anio = Number(m[1]);
  const n = Number(m[2]);
  if (n < 1 || n > 12) return null;
  const ultimo = new Date(Date.UTC(anio, n, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}
