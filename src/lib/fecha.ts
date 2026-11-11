/** Fechas y dinero. El consultorio trabaja en hora de Colombia. */

const ZONA = "America/Bogota";

/** Hoy en Colombia, como `AAAA-MM-DD` (el formato de <input type="date"> y de Postgres). */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

export function anioActual(): number {
  return Number(hoyBogota().slice(0, 4));
}

const fmtMes = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });

/** `2026-11-12` → `12 nov 2026`. Las fechas sin hora se leen en UTC para que no se corran un día. */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const f = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(f.getTime())) return "—";
  return `${f.getUTCDate()} ${fmtMes.format(f).replace(/\./g, "")} ${f.getUTCFullYear()}`;
}

export function formatearDinero(valor: number | null | undefined, moneda: "COP" | "USD" | null | undefined): string {
  if (valor == null) return "—";
  const n = Number(valor);
  if (moneda === "USD") {
    return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n)} USD`;
  }
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n)}`;
}
