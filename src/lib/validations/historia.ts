import { z } from "zod";
import { CAMPOS_SECCION } from "@/lib/historias";

const limpiar = (v: unknown) => (v == null ? null : typeof v === "string" ? v.trim() || null : v);
const texto = (max: number) => z.preprocess(limpiar, z.string().max(max, "El texto es demasiado largo.").nullable());
const fechaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").nullable(),
);
const uuid = z.uuid("Identificador inválido.");

export const seccionSchema = z.object({
  paciente_id: uuid,
  campo: z.enum(CAMPOS_SECCION),
  texto: texto(20000),
});

export const identificacionSchema = z.object({
  paciente_id: uuid,
  documento: texto(60),
  fecha_nacimiento: fechaOpcional,
  direccion: texto(300),
  seguridad_social: texto(200),
  estado_civil: texto(100),
  escolaridad: texto(200),
  ocupacion: texto(200),
  remision: texto(300),
  enfermedades: texto(1000),
  profesional: z.string().trim().min(2, "Escribe quién atiende.").max(200),
  fecha_consulta: fechaOpcional,
});

export const notaSchema = z.object({
  id: uuid,
  paciente_id: uuid,
  fecha: fechaOpcional,
  hora: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida.").nullable(),
  ),
  duracion_min: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(5, "Duración inválida.").max(480, "Duración inválida.").nullable(),
  ),
  modalidad: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(["online", "presencial"]).nullable()),
  formato: z.enum(["ser_elemental", "soap", "dap"]),
  campos: z.record(z.string().max(40), z.string().max(20000)),
  objetivos: z.array(uuid).max(60),
});
export type DatosNota = z.infer<typeof notaSchema>;

export const adendaSchema = z.object({
  nota_id: uuid,
  paciente_id: uuid,
  texto: z.string().trim().min(3, "Escribe la adenda.").max(10000),
});

export const objetivoSchema = z.object({
  paciente_id: uuid,
  nombre: z.string().trim().min(2, "Escribe el objetivo.").max(300),
});

/** Tope de cada adjunto. El formulario completo debe caber en el límite de Vercel (4,5 MB). */
export const MAX_ADJUNTO = 4 * 1024 * 1024;
export const TIPOS_ADJUNTO = [
  "application/pdf", "image/png", "image/jpeg", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
