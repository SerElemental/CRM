import { describe, expect, it } from "vitest";
import { dinero, fechaCorta, fechaLarga, numeroFactura, totalFactura } from "./tipos";

describe("formato de facturas", () => {
  it("fechas en los dos idiomas", () => {
    expect(fechaLarga("2026-10-13", "en")).toBe("October 13, 2026");
    expect(fechaLarga("2026-10-13", "es")).toBe("13 de octubre de 2026");
    expect(fechaCorta("2026-02-08", "es")).toBe("8 feb 2026");
    expect(fechaCorta("2026-02-08", "en")).toBe("Feb 8, 2026");
  });
  it("dinero", () => {
    expect(dinero(400000, "COP")).toBe("$400.000");
    expect(dinero(93000, "COP")).toBe("$93.000");
    expect(dinero(1250300, "COP")).toBe("$1.250.300");
    expect(dinero(35, "USD")).toBe("$35.00");
    expect(dinero(1250.5, "USD")).toBe("$1,250.50");
  });
  it("total y consecutivo", () => {
    expect(
      totalFactura([
        { descripcion: "a", cantidad: 2, valorUnitario: 35 },
        { descripcion: "b", cantidad: 1, valorUnitario: 130 },
      ]),
    ).toBe(200);
    expect(numeroFactura("INV", 2026, 1)).toBe("INV-2026-0001");
    expect(numeroFactura("CC", 2026, 123)).toBe("CC-2026-0123");
  });
});
