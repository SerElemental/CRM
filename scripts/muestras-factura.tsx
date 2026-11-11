/**
 * Genera PDF de muestra de los documentos de cobro, para revisar el diseño.
 *
 *   npm run muestras:factura
 *
 * Lee los datos de las dos empresas de `datos/emisores.json` (que NO se versiona:
 * trae cuentas bancarias) y escribe los PDF en la carpeta de arriba del
 * repositorio, `Muestras de facturas/`. Los clientes de las muestras son ficticios.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generarFacturaPDF } from "../src/lib/facturas/factura-pdf";
import { numeroFactura, type DatosFactura, type Emisor } from "../src/lib/facturas/tipos";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const emisores = JSON.parse(readFileSync(join(raiz, "datos", "emisores.json"), "utf8")) as Emisor[];
const emisor = (clave: string) => {
  const e = emisores.find((x) => x.clave === clave);
  if (!e) throw new Error(`Falta el emisor «${clave}» en datos/emisores.json`);
  return e;
};

const us = emisor("us");
const co = emisor("co");

const muestras: { archivo: string; datos: DatosFactura }[] = [
  {
    archivo: "Muestra - Invoice EEUU.pdf",
    datos: {
      numero: numeroFactura(us.prefijo, 2026, 1),
      fecha: "2026-11-11",
      emisor: us,
      cliente: { nombre: "Jane Sample", email: "jane.sample@example.com", telefono: "+1 (555) 010-0199" },
      items: [
        { descripcion: "Human Development Consulting session", fecha: "2026-11-04", cantidad: 1, valorUnitario: 130 },
        { descripcion: "Human Development Consulting session", fecha: "2026-11-11", cantidad: 1, valorUnitario: 130 },
      ],
    },
  },
  {
    archivo: "Muestra - Cuenta de cobro Colombia.pdf",
    datos: {
      numero: numeroFactura(co.prefijo, 2026, 1),
      fecha: "2026-11-11",
      emisor: co,
      cliente: {
        nombre: "Paciente de Ejemplo Restrepo",
        identificacion: "C.C. 1.000.000.000",
        email: "paciente@ejemplo.co",
        telefono: "300 000 0000",
      },
      items: [
        { descripcion: "Sesión de consulta psicológica", fecha: "2026-11-05", cantidad: 1, valorUnitario: 93000 },
        { descripcion: "Sesión de consulta psicológica", fecha: "2026-11-11", cantidad: 1, valorUnitario: 93000 },
      ],
    },
  },
  {
    // Caso largo: paquete, nota y varios renglones, para ver cómo crece la página.
    archivo: "Muestra - Cuenta de cobro Colombia (paquete).pdf",
    datos: {
      numero: numeroFactura(co.prefijo, 2026, 2),
      fecha: "2026-11-11",
      emisor: co,
      cliente: {
        nombre: "Empresa de Ejemplo S.A.S.",
        identificacion: "NIT 900.000.000-0",
        direccion: "Carrera 00 # 00 - 00, Medellín",
        email: "pagos@ejemplo.co",
      },
      items: [
        { descripcion: "Paquete de 4 sesiones de consulta psicológica", cantidad: 1, valorUnitario: 336000 },
        { descripcion: "Taller grupal «Mapa de sueños»", fecha: "2026-10-31", cantidad: 1, valorUnitario: 400000 },
        { descripcion: "Sesión de constelaciones familiares", fecha: "2026-11-07", cantidad: 2, valorUnitario: 120000 },
      ],
      notas: "Orden de compra n.º 000. Centro de costo de ejemplo.",
    },
  },
];

const salida = join(raiz, "..", "Muestras de facturas");
mkdirSync(salida, { recursive: true });
for (const m of muestras) {
  const ruta = join(salida, m.archivo);
  writeFileSync(ruta, await generarFacturaPDF(m.datos));
  console.log("✓", ruta);
}
