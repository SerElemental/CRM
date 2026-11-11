import { describe, expect, it } from "vitest";
import { formatearDinero, formatearFecha } from "./fecha";

describe("fecha y dinero", () => {
  it("formatea fechas sin correrlas de día", () => {
    expect(formatearFecha("2026-11-05")).toBe("5 nov 2026");
    expect(formatearFecha("2024-03-12")).toBe("12 mar 2024");
    expect(formatearFecha("2025-01-01")).toBe("1 ene 2025");
    expect(formatearFecha(null)).toBe("—");
  });
  it("formatea pesos y dólares", () => {
    expect(formatearDinero(93000, "COP")).toBe("$93.000");
    expect(formatearDinero(140, "USD")).toBe("140 USD");
    expect(formatearDinero(null, "COP")).toBe("—");
  });
});
