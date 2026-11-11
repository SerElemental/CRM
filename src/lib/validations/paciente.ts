import { z } from "zod";

/** Campo de formulario opcional: cadena vacía → null. */
const limpiar = (v: unknown) => (v == null ? null : typeof v === "string" ? v.trim() || null : v);
const textoOpcional = z.preprocess(limpiar, z.string().max(2000).nullable());
const fechaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").nullable(),
);
const idOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().positive().nullable(),
);
const valorOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
  z.number("Valor inválido.").min(0, "El valor no puede ser negativo.").nullable(),
);
const casilla = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const vacioANull = (v: unknown) => (v === "" || v == null ? null : v);

export const pacienteSchema = z
  .object({
  nombre_completo: z.string().trim().min(2, "Escribe el nombre completo.").max(200),
  tipo: z.enum(["individual", "pareja", "adolescente", "nino"]),
  documento: textoOpcional,
  pais: textoOpcional,
  telefono: textoOpcional,
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() || null : (v ?? null)),
    z.email("Correo inválido.").nullable(),
  ),
  grupo_whatsapp_id: idOpcional,
  estado: z.enum(["activo", "seguimiento", "inactivo", "inactivo_sin_pagar", "remitido"]),
  modalidad: z.preprocess(vacioANull, z.enum(["online", "presencial"]).nullable()),
  fecha_inicio: fechaOpcional,
  plan_trabajo_enviado: z.preprocess(vacioANull, z.enum(["si", "no", "no_aplica"]).nullable()),
  consentimiento: casilla,
  es_miembro: casilla,
  correo_membresia_enviado: casilla,
  plan_membresia_id: idOpcional,
  flyer_enviado: casilla,
  flyer_enviado_el: fechaOpcional,
  no_contactar: casilla,
  no_contactar_motivo: textoOpcional,
  notas: textoOpcional,
  // Contacto de emergencia
  emergencia_nombre: textoOpcional,
  emergencia_telefono: textoOpcional,
  emergencia_relacion: z.preprocess(vacioANull, z.enum(["mama", "papa", "esposo", "hijo", "otro"]).nullable()),
  emergencia_relacion_otra: textoOpcional,
  // Tarifas del año actual y del anterior.
  valor_actual: valorOpcional,
  moneda_actual: z.enum(["COP", "USD"]),
  valor_anterior: valorOpcional,
  moneda_anterior: z.enum(["COP", "USD"]),
})
  .superRefine((d, ctx) => {
    if (d.emergencia_relacion === "otro" && !d.emergencia_relacion_otra) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencia_relacion_otra"],
        message: "Escribe cuál es la relación.",
      });
    }
  });

export type PacienteInput = z.infer<typeof pacienteSchema>;

export const sesionNuevaSchema = z.object({
  paciente_id: z.uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de la sesión."),
  asistencia: z.enum(["realizada", "perdida"]),
  pago: z.enum(["pagada", "sin_pagar", "no_aplica"]),
  nota: textoOpcional,
});

export const paqueteSchema = z.object({
  paciente_id: z.uuid(),
  cantidad: z.coerce.number("Cantidad inválida.").int().min(1, "Mínimo 1 sesión.").max(50, "Máximo 50 sesiones."),
  nota: textoOpcional,
});

export const sesionEditarSchema = z.object({
  id: z.uuid(),
  paciente_id: z.uuid(),
  fecha: fechaOpcional,
  asistencia: z.enum(["realizada", "pendiente", "perdida"]),
  pago: z.enum(["pagada", "paquete", "sin_pagar", "no_aplica"]),
  nota: textoOpcional,
});
