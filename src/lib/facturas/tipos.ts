/**
 * Datos de un documento de cobro (factura de EE. UU. o cuenta de cobro de
 * Colombia). El PDF se dibuja SOLO con lo que hay aquí: es la «foto» del
 * documento en el momento de emitirlo, para que un cambio posterior en los datos
 * del paciente o de la empresa no altere documentos ya emitidos.
 */

export type Idioma = "es" | "en";
export type MonedaFactura = "COP" | "USD";

/** Una de las dos empresas de Marcela. Sus datos viven en la base, no en el código. */
export type Emisor = {
  /** `co` o `us`. */
  clave: string;
  idioma: Idioma;
  moneda: MonedaFactura;
  /** «Invoice», «Cuenta de cobro». */
  nombreDocumento: string;
  /** Prefijo del consecutivo: INV → INV-2026-0001. */
  prefijo: string;
  /** Frase bajo el logo. */
  lema: string;
  razonSocial: string;
  /** Persona que firma, con su nombre completo. */
  representante: string;
  /** Cómo se escribe la rúbrica (más corta que el nombre): «Marcela J. Salazar L.». */
  firma: string;
  /** Documento de quien firma, bajo su nombre: «C.C. … de Itagüí». Si falta, va la razón social. */
  documentoFirmante?: string | null;
  /** «NIT 1036606301-6», «C.C. …»; null si no aplica. */
  identificacion: string | null;
  direccion: string | null;
  ciudad: string;
  telefonos: string[];
  email: string;
  web: string;
  /** Líneas de «Información de pago», en orden: [etiqueta, valor]. */
  pago: [string, string][];
};

export type ClienteFactura = {
  nombre: string;
  /** «C.C. 1.234.567», «NIT …», «Passport …». */
  identificacion?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
};

export type ItemFactura = {
  descripcion: string;
  /** Fecha de la sesión (AAAA-MM-DD), si aplica. */
  fecha?: string | null;
  cantidad: number;
  valorUnitario: number;
};

export type DatosFactura = {
  numero: string;
  /** Fecha de emisión, AAAA-MM-DD. */
  fecha: string;
  emisor: Emisor;
  cliente: ClienteFactura;
  items: ItemFactura[];
  notas?: string | null;
};

export const TEXTOS: Record<Idioma, Record<string, string>> = {
  es: {
    para: "Cuenta de cobro a",
    de: "Debe a",
    fecha: "Fecha de emisión",
    descripcion: "Descripción",
    fechaSesion: "Fecha",
    cantidad: "Cant.",
    unitario: "Valor unitario",
    subtotal: "Subtotal",
    total: "Total a pagar",
    enLetras: "La suma de",
    pago: "Información de pago",
    notas: "Observaciones",
    gracias: "Gracias por tu confianza",
  },
  en: {
    para: "Issued to",
    de: "From",
    fecha: "Date of issue",
    descripcion: "Description",
    fechaSesion: "Date",
    cantidad: "Qty",
    unitario: "Unit price",
    subtotal: "Subtotal",
    total: "Total due",
    enLetras: "",
    pago: "Payment information",
    notas: "Notes",
    gracias: "Thank you",
  },
};

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function partes(iso: string): [number, number, number] | null {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return a && m && d ? [a, m, d] : null;
}

/** `2026-10-13` → «13 de octubre de 2026» / «October 13, 2026». */
export function fechaLarga(iso: string, idioma: Idioma): string {
  const p = partes(iso);
  if (!p) return iso;
  const [a, m, d] = p;
  return idioma === "es" ? `${d} de ${MESES_ES[m - 1]} de ${a}` : `${MESES_EN[m - 1]} ${d}, ${a}`;
}

/** `2026-02-08` → «8 feb 2026» / «Feb 8, 2026». */
export function fechaCorta(iso: string, idioma: Idioma): string {
  const p = partes(iso);
  if (!p) return iso;
  const [a, m, d] = p;
  return idioma === "es"
    ? `${d} ${MESES_ES[m - 1].slice(0, 3)} ${a}`
    : `${MESES_EN[m - 1].slice(0, 3)} ${d}, ${a}`;
}

/** Agrupa de a tres cifras: (1250300, ".") → «1.250.300». */
function miles(entero: string, separador: string): string {
  const grupos: string[] = [];
  for (let i = entero.length; i > 0; i -= 3) grupos.unshift(entero.slice(Math.max(0, i - 3), i));
  return grupos.join(separador);
}

/** Pesos sin decimales y con punto de miles; dólares con dos decimales. */
export function dinero(valor: number, moneda: MonedaFactura): string {
  if (moneda === "COP") return `$${miles(String(Math.round(valor)), ".")}`;
  const [entero, decimales] = valor.toFixed(2).split(".");
  return `$${miles(entero, ",")}.${decimales}`;
}

export function totalFactura(items: ItemFactura[]): number {
  return items.reduce((n, i) => n + i.cantidad * i.valorUnitario, 0);
}

/** Consecutivo: (INV, 2026, 1) → «INV-2026-0001». */
export function numeroFactura(prefijo: string, anio: number, consecutivo: number): string {
  return `${prefijo}-${anio}-${String(consecutivo).padStart(4, "0")}`;
}
