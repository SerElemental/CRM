import { describe, expect, it } from "vitest";
import { camposEscritos } from "./formatos";
import { edadEnAnios, formatearFechaHora, numeroHistoria, rangosDeSesiones } from "./index";

describe("historias", () => {
  it("numera las historias con cuatro cifras", () => {
    expect(numeroHistoria(7)).toBe("HC-0007");
    expect(numeroHistoria(12345)).toBe("HC-12345");
  });

  it("calcula la edad según si ya cumplió años", () => {
    expect(edadEnAnios("1992-06-14", "2026-06-13")).toBe(33);
    expect(edadEnAnios("1992-06-14", "2026-06-14")).toBe(34);
  });

  it("escribe los sellos de tiempo en hora de Colombia", () => {
    expect(formatearFechaHora("2026-11-09T21:58:00Z")).toBe("9 nov 2026, 4:58 p. m.");
  });

  it("resume las sesiones en tramos", () => {
    expect(rangosDeSesiones([24, 4, 5, 6, 9])).toBe("Sesiones 4 a 6, 9 y 24");
    expect(rangosDeSesiones([10, 11, 23])).toBe("Sesiones 10, 11 y 23");
    expect(rangosDeSesiones([25])).toBe("Sesión 25");
    expect(rangosDeSesiones([])).toBe("");
  });

  it("muestra los campos escritos en el orden del formato, sin esconder los de otro formato", () => {
    const campos = camposEscritos({
      formato: "ser_elemental",
      campos: { proxima: "Proyecto de vida", desarrollo: " Se revisa la tarea. ", tarea: "", plan: "Algo de SOAP" },
    });
    expect(campos.map((c) => [c.label, c.texto])).toEqual([
      ["Desarrollo", "Se revisa la tarea."],
      ["Próxima sesión", "Proyecto de vida"],
      ["Plan", "Algo de SOAP"],
    ]);
  });
});
