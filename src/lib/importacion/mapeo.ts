/**
 * Traducción del Excel «Registro de pacientes» al modelo del CRM.
 *
 * Funciones puras y sin dependencias: las usa el importador
 * (`scripts/importar-excel.mjs`, que carga este archivo directamente con Node)
 * y están cubiertas por `mapeo.test.ts`.
 */

export type Relleno = "amarillo" | "rojo" | "ninguno";
export type Asistencia = "realizada" | "pendiente" | "perdida";
export type Pago = "pagada" | "paquete" | "sin_pagar" | "no_aplica";
export type Moneda = "COP" | "USD";

export type SesionMapeada = {
  asistencia: Asistencia;
  pago: Pago;
  nota: string | null;
  /** La casilla tenía algo fuera del código habitual: conviene que Marcela la mire. */
  revisar: boolean;
};

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

/** Quita el «Microsoft Office User:» que Excel antepone a los comentarios. */
export function limpiarComentario(c: unknown): string | null {
  const t = texto(c)
    .replace(/^(microsoft office user|usuario)\s*:\s*/i, "")
    .replace(/\s*\n\s*/g, " · ")
    .trim();
  return t || null;
}

/**
 * Una casilla de sesión → una sesión, o `null` si la casilla está vacía.
 *
 * Código del Excel:
 *   amarillo           tenida y pagada
 *   amarillo + A       tenida, pagada por adelantado (paquete)
 *   amarillo + S       tenida; quedó debiendo y luego pagó
 *   S sin color        tenida, sin pagar
 *   A sin color        pagada por adelantado, todavía no la ha tenido
 *   rojo + A           pagó y la perdió (no asistió)
 *   rojo sin letra     no asistió (sin pago por adelantado)
 *
 * En una fila toda roja («no volver a contactar») el rojo es el fondo de la
 * fila y no dice nada de la sesión: solo cuentan las letras.
 */
export function mapearCasilla(c: {
  valor: unknown;
  relleno: Relleno;
  comentario?: unknown;
  filaRoja?: boolean;
}): SesionMapeada | null {
  const crudo = texto(c.valor);
  const v = crudo.toLowerCase();
  const comentario = limpiarComentario(c.comentario);
  const relleno: Relleno = c.filaRoja && c.relleno === "rojo" ? "ninguno" : c.relleno;

  // «ax» aparece como variante de A; se toma como A pero se deja para revisar.
  const letra = v === "a" || v === "ax" ? "a" : v === "s" ? "s" : null;
  const raro = crudo !== "" && v !== "a" && v !== "s";

  if (!letra && !raro && relleno === "ninguno") {
    // Sin color ni letra. Si solo hay un comentario, es una sesión perdida cuando
    // habla de una inasistencia o multa; si habla de otra cosa (un saldo a favor,
    // un abono) no es una sesión: el importador lo pasa a las notas del paciente.
    if (!comentario || !/inasist|no asist|multa|penalid|cancel/i.test(comentario)) return null;
  }

  let asistencia: Asistencia;
  let pago: Pago;
  let revisar = raro;

  if (relleno === "amarillo") {
    asistencia = "realizada";
    pago = letra === "a" ? "paquete" : "pagada";
  } else if (relleno === "rojo") {
    asistencia = "perdida";
    pago = letra === "a" ? "paquete" : letra === "s" ? "sin_pagar" : "no_aplica";
    if (letra === "s") revisar = true;
  } else if (letra === "a") {
    asistencia = "pendiente";
    pago = "paquete";
  } else if (letra === "s") {
    asistencia = "realizada";
    pago = "sin_pagar";
  } else {
    // Sin color ni letra reconocible: solo un comentario o un texto suelto
    // (casi siempre una multa o una cancelación tardía).
    asistencia = "perdida";
    pago = "no_aplica";
    revisar = true;
  }

  const partes = [raro ? `Excel: «${crudo}»` : null, comentario].filter(Boolean);
  const nota = partes.length ? `${revisar ? "[Revisar] " : ""}${partes.join(" · ")}` : null;
  return { asistencia, pago, nota: nota ?? (revisar ? "[Revisar]" : null), revisar };
}

// ───────────────────────── Datos del paciente ─────────────────────────

/** `93000` → COP · `"130 USD"` / `"4O USD"` / `"19,99 USD"` → USD. */
export function parsearValor(v: unknown): { valor: number; moneda: Moneda; revisar: boolean } | null {
  if (v == null || texto(v) === "") return null;
  if (typeof v === "number") {
    // Un valor de consulta menor a 1.000 no puede ser pesos.
    return v < 1000 ? { valor: v, moneda: "USD", revisar: true } : { valor: v, moneda: "COP", revisar: false };
  }
  const t = texto(v).toUpperCase();
  const esUsd = /USD/.test(t);
  // La letra O tecleada en lugar del cero («4O USD»).
  const numero = t.replace(/USD/g, "").replace(/O/g, "0").trim();
  if (!/^\d+([.,]\d+)?$/.test(numero)) return null;
  const n = Number(esUsd ? numero.replace(",", ".") : numero.replace(/[.,]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (esUsd) return { valor: n, moneda: "USD", revisar: numero !== t.replace(/USD/g, "").trim() };
  return n < 1000 ? { valor: n, moneda: "USD", revisar: true } : { valor: n, moneda: "COP", revisar: false };
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function fechaValida(a: number, m: number, d: number) {
  if (a < 2000 || a > 2100) return false;
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/**
 * Fechas del Excel: fecha real, número de serie de Excel o texto en español
 * («Mayo 2 de 2023», «Junio 18 2022», «Enero 23 DEL 2026»).
 * Si no se puede interpretar, devuelve el texto original para no perderlo.
 */
export function parsearFecha(v: unknown): { fecha: string | null; texto: string | null } {
  if (v == null || texto(v) === "") return { fecha: null, texto: null };
  if (v instanceof Date) {
    return Number.isNaN(v.getTime())
      ? { fecha: null, texto: null }
      : { fecha: iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()), texto: null };
  }
  const t = texto(v);
  // Número de serie de Excel (días desde 1899-12-30).
  if (typeof v === "number" || /^\d{5}$/.test(t)) {
    const serie = Number(t);
    if (serie > 36000 && serie < 60000) {
      const f = new Date(Date.UTC(1899, 11, 30) + serie * 86400000);
      return { fecha: iso(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()), texto: null };
    }
    return { fecha: null, texto: t };
  }
  const m = t.toLowerCase().match(/^([a-záéíóú]+)\s+(\d{1,2})\s*(?:d\s*e\s*l?\s+)?(\d{4})$/);
  if (m) {
    const mes = MESES[m[1]];
    const dia = Number(m[2]);
    const anio = Number(m[3]);
    if (mes && fechaValida(anio, mes, dia)) return { fecha: iso(anio, mes, dia), texto: null };
  }
  return { fecha: null, texto: t };
}

export type Estado = "activo" | "seguimiento" | "inactivo" | "inactivo_sin_pagar" | "remitido";

export function normalizarEstado(v: unknown): { estado: Estado; nota: string | null; revisar: boolean } {
  const t = texto(v).toUpperCase();
  if (t === "ACTIVO") return { estado: "activo", nota: null, revisar: false };
  if (t === "SEGUIMIENTO") return { estado: "seguimiento", nota: null, revisar: false };
  if (t === "INACTIVO") return { estado: "inactivo", nota: null, revisar: false };
  if (t === "INACTIVO SIN PAGAR") return { estado: "inactivo_sin_pagar", nota: null, revisar: false };
  if (t.startsWith("REMITID")) return { estado: "remitido", nota: `Estado en Excel: ${texto(v)}`, revisar: false };
  if (t === "") return { estado: "inactivo", nota: "Sin estado en el Excel", revisar: true };
  return { estado: "inactivo", nota: `Estado en Excel: ${texto(v)}`, revisar: true };
}

export type TipoPaciente = "individual" | "pareja" | "adolescente" | "nino";

const TIPOS: Record<string, TipoPaciente> = { pareja: "pareja", adolescente: "adolescente", "niño": "nino", nino: "nino" };
const SIN_DATO = new Set(["sin wh", "sin wht", "sin contacto", "n/a", "na", ""]);

/**
 * La columna «Grupo de WH» mezcla tres cosas: el grupo (Pacientes, Pacientes 2),
 * el tipo de paciente (Pareja, Adolescente, Niño) y notas sueltas.
 */
export function interpretarGrupo(v: unknown): {
  grupo: "Pacientes" | "Pacientes 2" | null;
  tipo: TipoPaciente | null;
  nota: string | null;
} {
  const t = texto(v);
  const k = t.toLowerCase();
  if (k === "pacientes") return { grupo: "Pacientes", tipo: null, nota: null };
  if (k === "pacientes 2") return { grupo: "Pacientes 2", tipo: null, nota: null };
  if (TIPOS[k]) return { grupo: null, tipo: TIPOS[k], nota: null };
  if (SIN_DATO.has(k)) return { grupo: null, tipo: null, nota: k === "sin contacto" ? "Sin contacto" : null };
  return { grupo: null, tipo: null, nota: t };
}

/** La columna «Contacto» trae teléfonos, pero también «Pareja», «Sin contacto»… */
export function interpretarContacto(v: unknown): {
  telefono: string | null;
  tipo: TipoPaciente | null;
  nota: string | null;
} {
  const t = texto(v);
  const k = t.toLowerCase();
  if (SIN_DATO.has(k)) return { telefono: null, tipo: null, nota: null };
  if (TIPOS[k]) return { telefono: null, tipo: TIPOS[k], nota: null };
  // Un teléfono tiene al menos 7 dígitos y nada de letras.
  const digitos = t.replace(/\D/g, "");
  if (digitos.length >= 7 && !/[a-záéíóúñ]/i.test(t)) return { telefono: t.replace(/\s+/g, " "), tipo: null, nota: null };
  return { telefono: null, tipo: null, nota: `Contacto: ${t}` };
}

/** Columnas de «X»: marcada o no. Cualquier otro texto cuenta como marcada, a revisar. */
export function esMarca(v: unknown): { marcado: boolean; revisar: boolean } {
  const k = texto(v).toLowerCase();
  if (k === "") return { marcado: false, revisar: false };
  return { marcado: true, revisar: k !== "x" };
}

export function normalizarPlanTrabajo(v: unknown): { plan: "si" | "no" | "no_aplica" | null; nota: string | null } {
  const t = texto(v);
  const k = t.toLowerCase();
  if (k === "") return { plan: null, nota: null };
  if (k === "si" || k === "sí") return { plan: "si", nota: null };
  if (k === "no") return { plan: "no", nota: null };
  if (k === "na" || k === "n/a") return { plan: "no_aplica", nota: null };
  return { plan: null, nota: `Plan de trabajo: ${t}` };
}

export function normalizarModalidad(v: unknown): "online" | "presencial" | null {
  const k = texto(v).toLowerCase();
  return k === "online" ? "online" : k === "presencial" ? "presencial" : null;
}
