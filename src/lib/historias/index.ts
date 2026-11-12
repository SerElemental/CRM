import type { Historia, HistoriaEstado, ObjetivoEstado } from "@/lib/database.types";
import { hoyBogota } from "../fecha";
import type { Tono } from "@/lib/tono";

/** Columnas de texto de la historia que se editan por separado (con autoguardado). */
export type CampoSeccion =
  | "motivo_consulta" | "antecedentes" | "nucleo_familiar" | "relaciones_sociales"
  | "relaciones_profesionales" | "metas_personales" | "metas_laborales"
  | "concepto_general" | "herramientas_apoyo";

export const CAMPOS_SECCION: CampoSeccion[] = [
  "motivo_consulta", "antecedentes", "nucleo_familiar", "relaciones_sociales",
  "relaciones_profesionales", "metas_personales", "metas_laborales", "concepto_general", "herramientas_apoyo",
];

export type Seccion = {
  campo: CampoSeccion;
  n: string;
  titulo: string;
  /** Texto corto para el índice lateral. */
  corto: string;
  /** Sub-bloques que van dentro de la misma tarjeta. */
  subs?: { campo: CampoSeccion; titulo: string }[];
  genograma?: boolean;
};

/** Las cinco secciones numeradas del «Registro de atención psicológica». */
export const SECCIONES: Seccion[] = [
  { campo: "motivo_consulta", n: "1", titulo: "Motivo de consulta", corto: "Motivo de consulta" },
  { campo: "antecedentes", n: "2", titulo: "Antecedentes clínicos o terapéuticos", corto: "Antecedentes" },
  {
    campo: "nucleo_familiar", n: "3", titulo: "Composición del núcleo familiar y relación con cada uno",
    corto: "Núcleo familiar", genograma: true,
  },
  {
    campo: "relaciones_sociales", n: "4", titulo: "Estado actual de las relaciones sociales (pareja, amigos, ocio)",
    corto: "Relaciones sociales",
  },
  {
    campo: "relaciones_profesionales", n: "5", titulo: "Estado actual de las relaciones académico-profesionales",
    corto: "Relaciones académico-profesionales",
    subs: [
      { campo: "metas_personales", titulo: "Metas personales" },
      { campo: "metas_laborales", titulo: "Metas laborales" },
    ],
  },
];

export const TITULO_CAMPO: Record<CampoSeccion, string> = {
  motivo_consulta: "Motivo de consulta",
  antecedentes: "Antecedentes clínicos o terapéuticos",
  nucleo_familiar: "Composición del núcleo familiar",
  relaciones_sociales: "Relaciones sociales",
  relaciones_profesionales: "Relaciones académico-profesionales",
  metas_personales: "Metas personales",
  metas_laborales: "Metas laborales",
  concepto_general: "Concepto general",
  herramientas_apoyo: "Herramientas de apoyo",
};

/** Datos de identificación propios de la historia (el resto vive en la ficha del paciente). */
export const IDENTIFICACION: { campo: keyof Historia; label: string; tipo?: "date" }[] = [
  { campo: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "date" },
  { campo: "direccion", label: "Dirección" },
  { campo: "seguridad_social", label: "Seguridad social" },
  { campo: "estado_civil", label: "Estado civil" },
  { campo: "escolaridad", label: "Escolaridad" },
  { campo: "ocupacion", label: "Ocupación" },
  { campo: "remision", label: "Remisión" },
  { campo: "enfermedades", label: "Enfermedades" },
  { campo: "profesional", label: "Profesional que atiende" },
  { campo: "fecha_consulta", label: "Fecha de consulta", tipo: "date" },
];

export const ESTADOS_HISTORIA: { value: HistoriaEstado; label: string }[] = [
  { value: "completa", label: "Completa" },
  { value: "incompleta", label: "Incompleta" },
  { value: "por_revisar", label: "Por revisar" },
];
export const ESTADO_HISTORIA_LABEL: Record<HistoriaEstado, string> = {
  completa: "Completa", incompleta: "Incompleta", por_revisar: "Por revisar",
};
export const ESTADO_HISTORIA_TONO: Record<HistoriaEstado, Tono> = {
  completa: "success", incompleta: "outline", por_revisar: "warning",
};

export const OBJETIVO_ESTADOS: { value: ObjetivoEstado; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "trabajado", label: "Trabajado" },
];
export const OBJETIVO_LABEL: Record<ObjetivoEstado, string> = {
  pendiente: "Pendiente", en_curso: "En curso", trabajado: "Trabajado",
};
export const OBJETIVO_TONO: Record<ObjetivoEstado, Tono> = {
  pendiente: "outline", en_curso: "warning", trabajado: "success",
};

/** `142` → `HC-0142`. */
export function numeroHistoria(n: number): string {
  return `HC-${String(n).padStart(4, "0")}`;
}

/** Años cumplidos a hoy (hora de Colombia) a partir de `AAAA-MM-DD`. */
export function edadEnAnios(nacimiento: string, hoy: string = hoyBogota()): number {
  const [a, m, d] = nacimiento.split("-").map(Number);
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/** «34 años»: calculada si hay fecha de nacimiento; si no, la que venía escrita. */
export function textoEdad(h: Pick<Historia, "fecha_nacimiento" | "edad_texto">): string | null {
  if (h.fecha_nacimiento) return `${edadEnAnios(h.fecha_nacimiento)} años`;
  return h.edad_texto;
}

const fmtFechaHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true,
});

/** Sello de tiempo → «9 nov 2026, 4:58 p. m.» (hora de Colombia). */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "—";
  const p = Object.fromEntries(fmtFechaHora.formatToParts(f).map((x) => [x.type, x.value]));
  // El «p. m.» de Intl trae espacios duros: se dejan normales para que el texto se pueda buscar y comparar.
  const periodo = (p.dayPeriod ?? "").replace(/[\u00a0\u202f]/g, " ");
  return `${p.day} ${p.month.replace(/\./g, "")} ${p.year}, ${p.hour}:${p.minute} ${periodo}`;
}

/** `[4,5,6,9,24]` → «Sesiones 4 a 6, 9 y 24». */
export function rangosDeSesiones(numeros: number[]): string {
  const ns = [...new Set(numeros)].sort((a, b) => a - b);
  if (ns.length === 0) return "";
  const tramos: string[] = [];
  for (let i = 0; i < ns.length; ) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    tramos.push(j === i ? `${ns[i]}` : j === i + 1 ? `${ns[i]}, ${ns[j]}` : `${ns[i]} a ${ns[j]}`);
    i = j + 1;
  }
  const lista = tramos.length > 1 ? `${tramos.slice(0, -1).join(", ")} y ${tramos.at(-1)}` : tramos[0];
  return `${ns.length === 1 ? "Sesión" : "Sesiones"} ${lista}`;
}

/** Lista de avisos de la importación, venga como venga del JSON. */
export function leerAvisos(avisos: unknown): string[] {
  return Array.isArray(avisos) ? avisos.filter((a): a is string => typeof a === "string") : [];
}
