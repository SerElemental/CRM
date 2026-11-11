import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Adobe Acrobat no dibuja un glifo que tenga más puntos o contornos de los que
 * la fuente declara en su tabla `maxp` (así desapareció la «@» de las facturas).
 * Esta prueba lee cada TTF y comprueba que ningún glifo supere esos máximos.
 */

const carpeta = join(process.cwd(), "src", "lib", "facturas", "fuentes");
const fuentes = readdirSync(carpeta).filter((f) => f.endsWith(".ttf"));

/** Lo mínimo de un TTF para contar puntos y contornos de sus glifos simples. */
function leer(archivo: string) {
  const b = readFileSync(join(carpeta, archivo));
  const tablas = new Map<string, number>();
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + i * 16;
    tablas.set(b.toString("latin1", o, o + 4), b.readUInt32BE(o + 8));
  }
  const tabla = (nombre: string) => {
    const o = tablas.get(nombre);
    if (o === undefined) throw new Error(`${archivo}: falta la tabla ${nombre}`);
    return o;
  };
  const maxp = tabla("maxp");
  const glifos = b.readUInt16BE(maxp + 4);
  const locaLargo = b.readInt16BE(tabla("head") + 50) === 1;
  const loca = tabla("loca");
  const glyf = tabla("glyf");
  const desplazamiento = (i: number) => (locaLargo ? b.readUInt32BE(loca + i * 4) : b.readUInt16BE(loca + i * 2) * 2);

  let masPuntos = 0;
  let masContornos = 0;
  for (let i = 0; i < glifos; i++) {
    const ini = desplazamiento(i);
    if (desplazamiento(i + 1) === ini) continue; // glifo vacío (el espacio)
    const contornos = b.readInt16BE(glyf + ini);
    if (contornos <= 0) continue; // compuesto: sus piezas se revisan como glifos simples
    // El último «punto final de contorno» + 1 es el número de puntos del glifo.
    const puntos = b.readUInt16BE(glyf + ini + 10 + (contornos - 1) * 2) + 1;
    masPuntos = Math.max(masPuntos, puntos);
    masContornos = Math.max(masContornos, contornos);
  }
  return {
    glifos,
    declarado: { puntos: b.readUInt16BE(maxp + 6), contornos: b.readUInt16BE(maxp + 8) },
    real: { puntos: masPuntos, contornos: masContornos },
  };
}

describe("tipografías de las facturas", () => {
  it("están las siete que usa la plantilla", () => {
    expect(fuentes.sort()).toEqual([
      "josefin-sans-300.ttf", "josefin-sans-400.ttf", "josefin-sans-600.ttf", "josefin-sans-700.ttf",
      "mrs-saint-delafield-400.ttf", "rufina-400.ttf", "rufina-700.ttf",
    ]);
  });

  it.each(fuentes)("%s: ningún glifo supera los máximos que la fuente declara", (archivo) => {
    const f = leer(archivo);
    expect(f.glifos).toBeGreaterThan(100);
    expect(f.real.puntos).toBeGreaterThan(0);
    expect(f.real.puntos).toBeLessThanOrEqual(f.declarado.puntos);
    expect(f.real.contornos).toBeLessThanOrEqual(f.declarado.contornos);
  });
});
