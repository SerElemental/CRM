/** Número entero → texto en español: 400000 → «cuatrocientos mil». Para el «valor en letras». */

const UNIDADES = [
  "", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once",
  "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
  "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos",
  "setecientos", "ochocientos", "novecientos",
];

/** 1–999. */
function centenas(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto < 30) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const u = resto % 10;
    const decena = DECENAS[Math.floor(resto / 10)];
    partes.push(u ? `${decena} y ${UNIDADES[u]}` : decena);
  }
  return partes.join(" ");
}

export function numeroALetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return "cero";
  if (n >= 1e12) return String(n);

  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${numeroALetras(millones)} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${centenas(miles)} mil`);
  if (resto) partes.push(centenas(resto));
  return partes.join(" ");
}

/**
 * Valor en letras para un documento de cobro en pesos:
 * 400000 → «Cuatrocientos mil pesos m/cte». Con millones exactos lleva «de»
 * («Dos millones de pesos»), como se escribe en Colombia.
 */
export function pesosEnLetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  const texto = numeroALetras(n);
  const de = n >= 1e6 && n % 1e6 === 0 ? " de" : "";
  const moneda = n === 1 ? "peso" : "pesos";
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}${de} ${moneda} m/cte`;
}
