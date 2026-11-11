import { describe, expect, it } from "vitest";
import {
  aplicarFiltros, FILTROS, filtrosAUrl, hayFiltros, leerFiltros, opcionesConConteo, SIN_DATO, type Faceta,
} from "./pacientes-filtros";

const facetas: Faceta[] = [
  { faceta: "pais", valor: "Colombia", total: 420 },
  { faceta: "pais", valor: "Arabia Saudita", total: 4 },
  { faceta: "pais", valor: "EEUU", total: 48 },
  { faceta: "pais", valor: null, total: 49 },
  { faceta: "estado", valor: "activo", total: 30 },
  { faceta: "estado", valor: "inactivo", total: 508 },
  { faceta: "flyer", valor: "si", total: 24 },
  { faceta: "plan", valor: null, total: 80 },
  { faceta: "plan", valor: "si", total: 463 },
  { faceta: "saldo", valor: "por_cobrar", total: 60 },
];
const opciones = opcionesConConteo(facetas);

/** Consulta de mentira que anota las llamadas que recibe. */
function espia() {
  const llamadas: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (llamadas.push(`eq ${c} ${v}`), q),
    in: (c: string, v: readonly unknown[]) => (llamadas.push(`in ${c} ${v.join("|")}`), q),
    is: (c: string) => (llamadas.push(`is ${c} null`), q),
    or: (f: string) => (llamadas.push(`or ${f}`), q),
    ilike: (c: string, p: string) => (llamadas.push(`ilike ${c} ${p}`), q),
  };
  return { q, llamadas };
}

describe("opciones de los filtros", () => {
  it("los países salen de los datos, de más a menos pacientes, con «Sin país»", () => {
    expect(opciones.pais.map((o) => `${o.label} ${o.total}`)).toEqual([
      "Colombia 420", "Sin país 49", "EEUU 48", "Arabia Saudita 4",
    ]);
    expect(opciones.pais[1].value).toBe(SIN_DATO);
  });
  it("las opciones fijas llevan su conteo (0 si no hay)", () => {
    expect(opciones.estado.find((o) => o.value === "activo")?.total).toBe(30);
    expect(opciones.estado.find((o) => o.value === "remitido")?.total).toBe(0);
    expect(opciones.plan.find((o) => o.value === SIN_DATO)?.total).toBe(80);
    expect(opciones.flyer.map((o) => o.total)).toEqual([24, 0]);
  });
});

describe("leer y escribir filtros en la URL", () => {
  it("acepta varios valores y descarta los que no existen", () => {
    const f = leerFiltros({ estado: "activo,inventado,activo", pais: "Colombia,Narnia", q: "  ana " }, opciones);
    expect(f.estado).toEqual(["activo"]);
    expect(f.pais).toEqual(["Colombia"]);
    expect(f.q).toBe("ana");
    expect(hayFiltros(f)).toBe(true);
  });
  it("sin parámetros no hay filtros y la URL queda limpia", () => {
    const f = leerFiltros({}, opciones);
    expect(hayFiltros(f)).toBe(false);
    expect(filtrosAUrl(f)).toBe("/pacientes");
  });
  it("ida y vuelta", () => {
    const f = leerFiltros({ pais: `Arabia Saudita,${SIN_DATO}`, flyer: "si", q: "peña" }, opciones);
    const url = new URL(filtrosAUrl(f), "http://x");
    expect(leerFiltros(Object.fromEntries(url.searchParams), opciones)).toEqual(f);
  });
});

describe("aplicarFiltros", () => {
  const con = (sp: Record<string, string>) => {
    const { q, llamadas } = espia();
    aplicarFiltros(q, leerFiltros(sp, opciones));
    return llamadas;
  };
  it("sin filtros no toca la consulta", () => expect(con({})).toEqual([]));
  it("varios estados", () =>
    expect(con({ estado: "activo,inactivo" })).toEqual(["in estado activo|inactivo"]));
  it("país con nombre compuesto y «sin país» a la vez", () =>
    expect(con({ pais: `Arabia Saudita,${SIN_DATO}` })).toEqual([
      'or pais.in.("Arabia Saudita"),pais.is.null',
    ]));
  it("solo «sin definir»", () => expect(con({ plan: SIN_DATO })).toEqual(["is plan_trabajo_enviado null"]));
  it("sí/no: una opción filtra, las dos no", () => {
    expect(con({ flyer: "si" })).toEqual(["eq flyer_enviado true"]);
    expect(con({ consentimiento: "no" })).toEqual(["eq consentimiento false"]);
    expect(con({ flyer: "si,no" })).toEqual([]);
  });
  it("saldo: una opción, o varias que se suman", () => {
    expect(con({ saldo: "por_cobrar" })).toEqual(["or sesiones_por_cobrar.gt.0"]);
    expect(con({ saldo: "por_cobrar,prepagadas" })).toEqual([
      "or sesiones_por_cobrar.gt.0,sesiones_prepagadas.gt.0",
    ]);
    expect(con({ saldo: "al_dia" })).toEqual(["or and(sesiones_por_cobrar.eq.0,sesiones_prepagadas.eq.0)"]);
    expect(con({ saldo: "inventado" })).toEqual([]);
  });
  it("el orden de los filtros en pantalla", () =>
    expect(FILTROS.map((f) => f.titulo)).toEqual([
      "Estado", "País", "Saldo", "Consentimiento", "Plan de trabajo", "Seguimiento",
    ]));
  it("la búsqueda ignora tildes y escapa comodines", () =>
    expect(con({ q: "Peña_50%" })).toEqual(["ilike busqueda %pena\\_50\\%%"]));
});
