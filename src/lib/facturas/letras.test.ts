import { describe, expect, it } from "vitest";
import { numeroALetras, pesosEnLetras } from "./letras";

describe("numeroALetras", () => {
  it.each([
    [0, "cero"], [1, "un"], [16, "dieciséis"], [21, "veintiún"], [30, "treinta"], [45, "cuarenta y cinco"],
    [100, "cien"], [101, "ciento un"], [515, "quinientos quince"], [999, "novecientos noventa y nueve"],
    [1000, "mil"], [2000, "dos mil"], [21000, "veintiún mil"], [93000, "noventa y tres mil"],
    [100000, "cien mil"], [336000, "trescientos treinta y seis mil"], [400000, "cuatrocientos mil"],
    [1000000, "un millón"], [1250300, "un millón doscientos cincuenta mil trescientos"],
    [2000000, "dos millones"],
  ])("%i → %s", (n, texto) => expect(numeroALetras(n)).toBe(texto));
});

describe("pesosEnLetras", () => {
  it("pone mayúscula inicial y la moneda", () => {
    expect(pesosEnLetras(400000)).toBe("Cuatrocientos mil pesos m/cte");
    expect(pesosEnLetras(93000)).toBe("Noventa y tres mil pesos m/cte");
    expect(pesosEnLetras(1)).toBe("Un peso m/cte");
  });
  it("millones exactos llevan «de»", () => {
    expect(pesosEnLetras(2000000)).toBe("Dos millones de pesos m/cte");
    expect(pesosEnLetras(1000000)).toBe("Un millón de pesos m/cte");
    expect(pesosEnLetras(1500000)).toBe("Un millón quinientos mil pesos m/cte");
  });
});
