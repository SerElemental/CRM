import type { HistoriaNota, NotaFormato } from "@/lib/database.types";

export type CampoNota = { clave: string; label: string; filas: number };

/**
 * Formatos de la nota de sesión. «Ser Elemental» es el que Marcela ya usaba en
 * Word; SOAP y DAP son los habituales del software clínico. Los textos se
 * guardan en `historia_notas.campos`, una clave por campo.
 */
export const FORMATOS: Record<NotaFormato, { label: string; campos: CampoNota[] }> = {
  ser_elemental: {
    label: "Ser Elemental",
    campos: [
      { clave: "desarrollo", label: "Desarrollo de la sesión", filas: 9 },
      { clave: "tarea", label: "Tarea", filas: 3 },
      { clave: "herramientas", label: "Herramientas de apoyo", filas: 2 },
      { clave: "proxima", label: "Próxima sesión", filas: 3 },
    ],
  },
  soap: {
    label: "SOAP",
    campos: [
      { clave: "subjetivo", label: "Subjetivo (lo que refiere el paciente)", filas: 4 },
      { clave: "objetivo", label: "Objetivo (lo que se observa)", filas: 4 },
      { clave: "analisis", label: "Análisis", filas: 4 },
      { clave: "plan", label: "Plan", filas: 3 },
    ],
  },
  dap: {
    label: "DAP",
    campos: [
      { clave: "datos", label: "Datos (lo dicho y lo observado)", filas: 6 },
      { clave: "analisis", label: "Análisis", filas: 4 },
      { clave: "plan", label: "Plan", filas: 3 },
    ],
  },
};

export const LISTA_FORMATOS = (Object.keys(FORMATOS) as NotaFormato[]).map((value) => ({
  value, label: FORMATOS[value].label,
}));

const ETIQUETAS: Record<string, string> = Object.fromEntries(
  Object.values(FORMATOS).flatMap((f) => f.campos.map((c) => [c.clave, c.label.replace(/ \(.*\)$/, "")])),
);
ETIQUETAS.desarrollo = "Desarrollo";

/**
 * Lo escrito en una nota, en el orden de su formato. Si quedó texto en campos
 * de otro formato (porque se cambió a mitad de camino), también sale: nada se oculta.
 */
export function camposEscritos(nota: Pick<HistoriaNota, "formato" | "campos">): { clave: string; label: string; texto: string }[] {
  const campos = nota.campos ?? {};
  const orden = FORMATOS[nota.formato]?.campos.map((c) => c.clave) ?? [];
  const claves = [...orden, ...Object.keys(campos).filter((k) => !orden.includes(k))];
  return claves
    .map((clave) => ({ clave, label: ETIQUETAS[clave] ?? clave, texto: (campos[clave] ?? "").trim() }))
    .filter((c) => c.texto);
}

/** Todo el texto de una nota en una sola cadena, para buscar. */
export function textoDeNota(nota: Pick<HistoriaNota, "formato" | "campos">): string {
  return camposEscritos(nota).map((c) => c.texto).join(" ");
}
