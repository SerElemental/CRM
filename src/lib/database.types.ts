/**
 * Tipos de la base de datos. Se mantienen A MANO, al ritmo de las migraciones
 * de `supabase/migrations/`. Si cambias una tabla, cambia también este archivo.
 */

export type Moneda = "COP" | "USD";
export type PacienteTipo = "individual" | "pareja" | "adolescente" | "nino";
export type PacienteEstado = "activo" | "seguimiento" | "inactivo" | "inactivo_sin_pagar" | "remitido";
export type Modalidad = "online" | "presencial";
export type PlanTrabajo = "si" | "no" | "no_aplica";
export type SesionAsistencia = "realizada" | "pendiente" | "perdida";
export type SesionPago = "pagada" | "paquete" | "sin_pagar" | "no_aplica";
export type SesionOrigen = "excel" | "crm";
export type RelacionEmergencia = "mama" | "papa" | "esposo" | "hijo" | "otro";

type Tabla<Row, Opcionales extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Opcionales> & Partial<Pick<Row, Opcionales>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Profile = {
  id: string;
  nombre: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GrupoWhatsapp = { id: number; nombre: string; activo: boolean };

export type PlanMembresia = {
  id: number;
  nombre: string;
  precio: number;
  moneda: Moneda;
  periodicidad: string | null;
  activo: boolean;
};

export type Paciente = {
  id: string;
  numero: number | null;
  excel_fila: number | null;
  nombre_completo: string;
  tipo: PacienteTipo;
  pais: string | null;
  telefono: string | null;
  email: string | null;
  grupo_whatsapp_id: number | null;
  estado: PacienteEstado;
  modalidad: Modalidad | null;
  fecha_inicio: string | null;
  fecha_inicio_texto: string | null;
  ultima_sesion: string | null;
  plan_trabajo_enviado: PlanTrabajo | null;
  consentimiento: boolean;
  es_miembro: boolean;
  correo_membresia_enviado: boolean;
  plan_membresia_id: number | null;
  flyer_enviado: boolean;
  flyer_enviado_el: string | null;
  no_contactar: boolean;
  no_contactar_motivo: string | null;
  notas: string | null;
  emergencia_nombre: string | null;
  emergencia_telefono: string | null;
  emergencia_relacion: RelacionEmergencia | null;
  emergencia_relacion_otra: string | null;
  busqueda: string;
  created_at: string;
  updated_at: string;
};

export type PacienteTarifa = { paciente_id: string; anio: number; valor: number; moneda: Moneda };

export type Sesion = {
  id: string;
  paciente_id: string;
  numero: number;
  fecha: string | null;
  asistencia: SesionAsistencia;
  pago: SesionPago;
  valor: number | null;
  moneda: Moneda | null;
  nota: string | null;
  origen: SesionOrigen;
  created_at: string;
  updated_at: string;
};

/** Vista `pacientes_listado`: paciente + nombre del grupo + contadores de sesiones. */
export type PacienteListado = Paciente & {
  grupo_whatsapp: string | null;
  sesiones_total: number;
  sesiones_realizadas: number;
  sesiones_por_cobrar: number;
  sesiones_prepagadas: number;
  sesiones_perdidas: number;
};

/** Vista `pacientes_facetas`: cuántos pacientes hay por valor de cada filtro. */
export type PacienteFaceta = { faceta: string; valor: string | null; total: number };

export type Database = {
  public: {
    Tables: {
      profiles: Tabla<Profile, "nombre" | "activo" | "created_at" | "updated_at">;
      grupos_whatsapp: Tabla<GrupoWhatsapp, "id" | "activo">;
      planes_membresia: Tabla<PlanMembresia, "id" | "moneda" | "periodicidad" | "activo">;
      pacientes: Tabla<Paciente, Exclude<keyof Paciente, "nombre_completo">>;
      paciente_tarifas: Tabla<PacienteTarifa, "moneda">;
      sesiones: Tabla<
        Sesion,
        "id" | "fecha" | "valor" | "moneda" | "nota" | "origen" | "created_at" | "updated_at"
      >;
    };
    Views: {
      pacientes_listado: { Row: PacienteListado; Relationships: [] };
      pacientes_facetas: { Row: PacienteFaceta; Relationships: [] };
    };
    Functions: {
      registrar_sesion: {
        Args: {
          p_paciente: string;
          p_fecha: string;
          p_asistencia: SesionAsistencia;
          p_pago: SesionPago;
          p_nota?: string | null;
        };
        Returns: string;
      };
      registrar_paquete: {
        Args: { p_paciente: string; p_cantidad: number; p_nota?: string | null };
        Returns: number;
      };
    };
    Enums: {
      moneda: Moneda;
      paciente_tipo: PacienteTipo;
      paciente_estado: PacienteEstado;
      modalidad: Modalidad;
      plan_trabajo: PlanTrabajo;
      sesion_asistencia: SesionAsistencia;
      sesion_pago: SesionPago;
      sesion_origen: SesionOrigen;
    };
    CompositeTypes: Record<string, never>;
  };
};
