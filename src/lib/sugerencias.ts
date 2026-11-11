/**
 * Autocompletado del buscador de pacientes: orden de las sugerencias y resaltado
 * de la parte que coincide. Funciones puras (sin imports con alias).
 */

export type Sugerencia = {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  email: string | null;
  estado: string;
  pais: string | null;
};

/** Cuántas sugerencias se muestran como máximo. */
export const MAX_SUGERENCIAS = 8;
/** A partir de cuántas letras se empieza a sugerir. */
export const MIN_LETRAS = 2;

/** Una letra sin tilde y en minúscula (mantiene la longitud: «á» → «a», «ñ» → «n»). */
const plana = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || c;

/** Texto sin tildes y en minúsculas, letra por letra, para que los índices coincidan con el original. */
function aplanar(texto: string): string {
  let salida = "";
  for (const c of texto) salida += plana(c).slice(0, c.length);
  return salida;
}

/**
 * Qué tan buena es una coincidencia (menor = mejor):
 * 0 el nombre empieza por lo escrito · 1 alguna palabra del nombre empieza así ·
 * 2 está en medio del nombre · 3 coincide por teléfono o correo.
 */
function puntaje(s: Sugerencia, q: string): number {
  const nombre = aplanar(s.nombre_completo);
  if (nombre.startsWith(q)) return 0;
  if (nombre.split(/\s+/).some((p) => p.startsWith(q))) return 1;
  if (nombre.includes(q)) return 2;
  return 3;
}

/** Ordena de mejor a peor coincidencia, quita repetidos y deja las primeras. */
export function ordenarSugerencias(filas: Sugerencia[], consulta: string): Sugerencia[] {
  const q = aplanar(consulta.trim());
  const unicas = [...new Map(filas.map((f) => [f.id, f])).values()];
  return unicas
    .map((s) => ({ s, p: puntaje(s, q) }))
    .sort((a, b) => a.p - b.p || a.s.nombre_completo.localeCompare(b.s.nombre_completo, "es"))
    .slice(0, MAX_SUGERENCIAS)
    .map((x) => x.s);
}

export type Tramo = { texto: string; coincide: boolean };

/** Parte `texto` en tramos, marcando la primera aparición de lo escrito (sin distinguir tildes). */
export function resaltar(texto: string, consulta: string): Tramo[] {
  const q = aplanar(consulta.trim());
  const i = q ? aplanar(texto).indexOf(q) : -1;
  if (i < 0) return [{ texto, coincide: false }];
  return [
    { texto: texto.slice(0, i), coincide: false },
    { texto: texto.slice(i, i + q.length), coincide: true },
    { texto: texto.slice(i + q.length), coincide: false },
  ].filter((t) => t.texto !== "");
}

/** Dato de contacto que acompaña al nombre: el que coincide con lo escrito o, si no, el teléfono. */
export function detalleSugerencia(s: Sugerencia, consulta: string): string | null {
  const q = aplanar(consulta.trim());
  if (q && !aplanar(s.nombre_completo).includes(q)) {
    if (s.email && aplanar(s.email).includes(q)) return s.email;
    if (s.telefono && aplanar(s.telefono).includes(q)) return s.telefono;
  }
  return s.telefono ?? s.email;
}
