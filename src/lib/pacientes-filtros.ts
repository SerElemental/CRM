/**
 * Filtros del listado de pacientes. Un solo lugar define qué filtros hay, cómo
 * se leen de la URL y cómo se traducen a la consulta; lo usan la página (servidor)
 * y la barra de filtros (navegador).
 *
 * Sin imports con alias: `scripts/` también carga este archivo directamente.
 */

export type ClaveFiltro = "pais" | "flyer" | "estado" | "plan" | "consentimiento";

/** Valor que representa «sin dato» (la columna está vacía). */
export const SIN_DATO = "sin_dato";

export type Opcion = { value: string; label: string; total?: number };

export type DefinicionFiltro = {
  clave: ClaveFiltro;
  titulo: string;
  /** Opciones fijas. El país no tiene: sale de los datos. */
  opciones?: Opcion[];
};

/** En el orden en que se muestran. */
export const FILTROS: DefinicionFiltro[] = [
  {
    clave: "estado",
    titulo: "Estado",
    opciones: [
      { value: "activo", label: "Activo" },
      { value: "seguimiento", label: "Seguimiento" },
      { value: "inactivo", label: "Inactivo" },
      { value: "inactivo_sin_pagar", label: "Inactivo sin pagar" },
      { value: "remitido", label: "Remitido" },
    ],
  },
  { clave: "pais", titulo: "País" },
  {
    clave: "consentimiento",
    titulo: "Consentimiento",
    opciones: [
      { value: "si", label: "Firmado" },
      { value: "no", label: "Sin firmar" },
    ],
  },
  {
    clave: "plan",
    titulo: "Plan de trabajo enviado",
    opciones: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" },
      { value: "no_aplica", label: "No aplica" },
      { value: SIN_DATO, label: "Sin definir" },
    ],
  },
  {
    clave: "flyer",
    titulo: "Seguimiento flyer",
    opciones: [
      { value: "si", label: "Flyer enviado" },
      { value: "no", label: "Sin flyer" },
    ],
  },
];

export type FiltrosActivos = { q: string } & Record<ClaveFiltro, string[]>;

export type Faceta = { faceta: string; valor: string | null; total: number };

/** Opciones de cada filtro con su conteo. Las del país salen de los datos, de más a menos pacientes. */
export function opcionesConConteo(facetas: Faceta[]): Record<ClaveFiltro, Opcion[]> {
  const total = (clave: string, valor: string | null) =>
    facetas.find((f) => f.faceta === clave && f.valor === valor)?.total ?? 0;

  const salida = {} as Record<ClaveFiltro, Opcion[]>;
  for (const f of FILTROS) {
    if (f.opciones) {
      salida[f.clave] = f.opciones.map((o) => ({
        ...o,
        total: total(f.clave, o.value === SIN_DATO ? null : o.value),
      }));
    } else {
      salida[f.clave] = facetas
        .filter((x) => x.faceta === f.clave)
        .sort((a, b) => b.total - a.total || String(a.valor).localeCompare(String(b.valor), "es"))
        .map((x) => ({
          value: x.valor ?? SIN_DATO,
          label: x.valor ?? "Sin país",
          total: x.total,
        }));
    }
  }
  return salida;
}

type Parametros = Record<string, string | string[] | undefined>;

/**
 * Lee los filtros de la URL. Cada filtro acepta varios valores separados por
 * coma (`?estado=activo,seguimiento`). Solo se aceptan valores que existen como
 * opción: lo demás se ignora.
 */
export function leerFiltros(sp: Parametros, opciones: Record<ClaveFiltro, Opcion[]>): FiltrosActivos {
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const activos = { q: uno(sp.q).trim().slice(0, 100) } as FiltrosActivos;
  for (const f of FILTROS) {
    const validos = new Set(opciones[f.clave].map((o) => o.value));
    activos[f.clave] = [...new Set(uno(sp[f.clave]).split(",").map((v) => v.trim()))].filter((v) =>
      validos.has(v),
    );
  }
  return activos;
}

/** Los filtros como parámetros de URL (sin los vacíos). */
export function filtrosAUrl(f: FiltrosActivos): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const d of FILTROS) if (f[d.clave].length) p.set(d.clave, f[d.clave].join(","));
  const s = p.toString();
  return s ? `/pacientes?${s}` : "/pacientes";
}

export function hayFiltros(f: FiltrosActivos): boolean {
  return Boolean(f.q) || FILTROS.some((d) => f[d.clave].length > 0);
}

/** Texto de búsqueda como lo guarda la base: minúsculas y sin tildes. */
export function normalizarBusqueda(q: string): string {
  return q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Lo mínimo del constructor de consultas de Supabase que se necesita aquí. */
type Consulta<Q> = {
  eq(columna: string, valor: unknown): Q;
  in(columna: string, valores: readonly unknown[]): Q;
  is(columna: string, valor: null): Q;
  or(filtro: string): Q;
  ilike(columna: string, patron: string): Q;
};

/** «columna ∈ valores», donde SIN_DATO significa «columna vacía». */
function enLista<Q extends Consulta<Q>>(q: Q, columna: string, valores: string[]): Q {
  const reales = valores.filter((v) => v !== SIN_DATO);
  if (!valores.includes(SIN_DATO)) return q.in(columna, reales);
  if (reales.length === 0) return q.is(columna, null);
  // PostgREST: los valores con espacios, comas o tildes van entre comillas dobles.
  const lista = reales.map((v) => `"${v.replace(/["\\]/g, "\\$&")}"`).join(",");
  return q.or(`${columna}.in.(${lista}),${columna}.is.null`);
}

/** Un filtro de sí/no: marcar las dos opciones (o ninguna) equivale a no filtrar. */
function siNo<Q extends Consulta<Q>>(q: Q, columna: string, valores: string[]): Q {
  return valores.length === 1 ? q.eq(columna, valores[0] === "si") : q;
}

/** Aplica los filtros activos a una consulta sobre `pacientes_listado`. */
export function aplicarFiltros<Q extends Consulta<Q>>(q: Q, f: FiltrosActivos): Q {
  if (f.q) {
    const texto = normalizarBusqueda(f.q).replace(/[\\%_]/g, "\\$&");
    if (texto) q = q.ilike("busqueda", `%${texto}%`);
  }
  if (f.estado.length) q = q.in("estado", f.estado);
  if (f.pais.length) q = enLista(q, "pais", f.pais);
  if (f.plan.length) q = enLista(q, "plan_trabajo_enviado", f.plan);
  q = siNo(q, "flyer_enviado", f.flyer);
  q = siNo(q, "consentimiento", f.consentimiento);
  return q;
}
