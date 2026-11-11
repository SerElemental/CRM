import { describe, expect, it } from "vitest";
import { detalleSugerencia, MAX_SUGERENCIAS, ordenarSugerencias, resaltar, type Sugerencia } from "./sugerencias";

const p = (id: string, nombre: string, extra: Partial<Sugerencia> = {}): Sugerencia => ({
  id, nombre_completo: nombre, telefono: null, email: null, estado: "activo", pais: null, ...extra,
});

describe("ordenarSugerencias", () => {
  const filas = [
    p("1", "Adriana Peña"),
    p("2", "Mariana Soto"),
    p("3", "Ana María Ruiz"),
    p("4", "Luz Ana Gómez"),
    p("5", "Pedro Díaz", { email: "banana@ejemplo.co" }),
    p("6", "Andrés Mora"),
  ];
  it("primero los que empiezan así, luego palabra que empieza, luego en medio, luego contacto", () => {
    expect(ordenarSugerencias(filas, "an").map((s) => s.nombre_completo)).toEqual([
      "Ana María Ruiz", "Andrés Mora", "Luz Ana Gómez", "Adriana Peña", "Mariana Soto", "Pedro Díaz",
    ]);
  });
  it("no distingue tildes ni mayúsculas", () => {
    expect(ordenarSugerencias(filas, "ANDRES")[0].nombre_completo).toBe("Andrés Mora");
    expect(ordenarSugerencias(filas, "peña")[0].nombre_completo).toBe("Adriana Peña");
    expect(ordenarSugerencias(filas, "pena")[0].nombre_completo).toBe("Adriana Peña");
  });
  it("quita repetidos y limita la cantidad", () => {
    const muchas = Array.from({ length: 30 }, (_, i) => p(String(i % 20), `Ana ${String(i % 20).padStart(2, "0")}`));
    const r = ordenarSugerencias(muchas, "ana");
    expect(r).toHaveLength(MAX_SUGERENCIAS);
    expect(new Set(r.map((s) => s.id)).size).toBe(MAX_SUGERENCIAS);
  });
});

describe("resaltar", () => {
  it("marca la parte que coincide, respetando las tildes del original", () => {
    expect(resaltar("Andrés Mora", "andres")).toEqual([
      { texto: "Andrés", coincide: true }, { texto: " Mora", coincide: false },
    ]);
    expect(resaltar("Adriana Peña", "peñ")).toEqual([
      { texto: "Adriana ", coincide: false }, { texto: "Peñ", coincide: true }, { texto: "a", coincide: false },
    ]);
  });
  it("sin coincidencia devuelve el texto tal cual", () => {
    expect(resaltar("Pedro Díaz", "xyz")).toEqual([{ texto: "Pedro Díaz", coincide: false }]);
    expect(resaltar("Pedro Díaz", "  ")).toEqual([{ texto: "Pedro Díaz", coincide: false }]);
  });
});

describe("detalleSugerencia", () => {
  const s = p("1", "Pedro Díaz", { telefono: "300 111 2233", email: "banana@ejemplo.co" });
  it("muestra el dato por el que coincidió", () => {
    expect(detalleSugerencia(s, "banana")).toBe("banana@ejemplo.co");
    expect(detalleSugerencia(s, "111")).toBe("300 111 2233");
  });
  it("si coincide por nombre, muestra el teléfono (o el correo si no hay)", () => {
    expect(detalleSugerencia(s, "pedro")).toBe("300 111 2233");
    expect(detalleSugerencia({ ...s, telefono: null }, "pedro")).toBe("banana@ejemplo.co");
  });
});
