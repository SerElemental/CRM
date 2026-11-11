/**
 * Validación de lo que entra y sale del módulo de facturas: los datos de la
 * empresa guardados en la base (jsonb), y lo que envía el formulario.
 */
import { z } from "zod";
import type { ClienteFactura, DatosFactura, Emisor, ItemFactura } from "./tipos";

const textoONull = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
  z.string().max(300).nullable(),
);

export const emisorSchema = z.object({
  clave: z.string().regex(/^[a-z]{2,10}$/),
  idioma: z.enum(["es", "en"]),
  moneda: z.enum(["COP", "USD"]),
  nombreDocumento: z.string().min(1),
  prefijo: z.string().regex(/^[A-Z]{1,6}$/),
  lema: z.string(),
  razonSocial: z.string().min(1),
  representante: z.string().min(1),
  firma: z.string().min(1),
  documentoFirmante: z.string().nullish(),
  identificacion: z.string().nullable(),
  direccion: z.string().nullable(),
  ciudad: z.string(),
  telefonos: z.array(z.string()),
  email: z.string(),
  web: z.string(),
  pago: z.array(z.tuple([z.string(), z.string()])),
});

/** Los `datos` de una fila de `emisores` (o la «foto» guardada en una factura) como `Emisor`. */
export function leerEmisor(datos: unknown): Emisor {
  return emisorSchema.parse(datos) satisfies Emisor;
}

export const clienteSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe a nombre de quién va el documento.").max(200),
  identificacion: textoONull,
  email: textoONull,
  telefono: textoONull,
  direccion: textoONull,
});

export const itemSchema = z.object({
  descripcion: z.string().trim().min(1, "Cada renglón necesita una descripción.").max(300),
  fecha: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de renglón inválida.").nullable(),
  ),
  cantidad: z.coerce.number("Cantidad inválida.").positive("La cantidad debe ser mayor que cero.").max(999),
  valorUnitario: z.coerce.number("Valor inválido.").min(0, "El valor no puede ser negativo.").max(1e10),
  /** Sesión del paciente que cubre este renglón, si se eligió de la lista. */
  sesionId: z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable()),
});

/** Lo que envía «Nueva factura». */
export const facturaNuevaSchema = z.object({
  emisor: z.string().regex(/^[a-z]{2,10}$/, "Elige la empresa."),
  pacienteId: z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable()),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  cliente: clienteSchema,
  items: z.array(itemSchema).min(1, "Agrega al menos un renglón.").max(40),
  notas: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
    z.string().max(1000).nullable(),
  ),
});

export type FacturaNueva = z.infer<typeof facturaNuevaSchema>;

/** Renglones tal como se guardan y se pintan (sin el vínculo a la sesión). */
export function itemsParaGuardar(items: FacturaNueva["items"]): ItemFactura[] {
  return items.map(({ descripcion, fecha, cantidad, valorUnitario }) => ({
    descripcion, fecha, cantidad, valorUnitario,
  }));
}

const itemGuardadoSchema = z.object({
  descripcion: z.string(),
  fecha: z.string().nullish(),
  cantidad: z.coerce.number(),
  valorUnitario: z.coerce.number(),
});

/** Una fila de `facturas` → lo que necesita el PDF. */
export function facturaADatos(f: {
  numero: string; fecha: string; cliente: unknown; emisor: unknown; items: unknown;
  notas: string | null; estado: string;
}): DatosFactura {
  return {
    numero: f.numero,
    fecha: f.fecha,
    emisor: leerEmisor(f.emisor),
    cliente: clienteSchema.parse(f.cliente) satisfies ClienteFactura,
    items: z.array(itemGuardadoSchema).parse(f.items),
    notas: f.notas,
    sello: f.estado === "anulada" ? "anulada" : null,
  };
}
