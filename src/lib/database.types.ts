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
export type FacturaEstado = "emitida" | "pagada" | "anulada";

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
  documento: string | null;
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

/** Empresa que factura. `datos` tiene la forma del tipo `Emisor` de `lib/facturas/tipos.ts`. */
export type EmisorFila = { clave: string; datos: unknown; orden: number; activo: boolean; updated_at: string };

export type Factura = {
  id: string;
  emisor_clave: string;
  paciente_id: string | null;
  numero: string;
  anio: number;
  consecutivo: number;
  fecha: string;
  moneda: Moneda;
  total: number;
  /** «Fotos» del momento de emitir (ver `lib/facturas/tipos.ts`). */
  cliente: unknown;
  emisor: unknown;
  items: unknown;
  notas: string | null;
  estado: FacturaEstado;
  pagada_el: string | null;
  anulada_el: string | null;
  anulada_motivo: string | null;
  creada_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Vista `facturas_listado`. */
export type FacturaListado = Pick<
  Factura,
  "id" | "numero" | "fecha" | "emisor_clave" | "paciente_id" | "moneda" | "total" | "estado" | "pagada_el" | "created_at"
> & { cliente_nombre: string | null; paciente_nombre: string | null; busqueda: string };

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
      emisores: Tabla<EmisorFila, "orden" | "activo" | "updated_at">;
      facturas: { Row: Factura; Insert: never; Update: never; Relationships: [] };
      factura_sesiones: {
        Row: { factura_id: string; sesion_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sesiones: Tabla<
        Sesion,
        "id" | "fecha" | "valor" | "moneda" | "nota" | "origen" | "created_at" | "updated_at"
      >;
    };
    Views: {
      pacientes_listado: { Row: PacienteListado; Relationships: [] };
      pacientes_facetas: { Row: PacienteFaceta; Relationships: [] };
      facturas_listado: { Row: FacturaListado; Relationships: [] };
      sesiones_por_facturar: { Row: Sesion; Relationships: [] };
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
      emitir_factura: {
        Args: {
          p_emisor: string;
          p_paciente: string | null;
          p_fecha: string;
          p_cliente: unknown;
          p_items: unknown;
          p_notas?: string | null;
          p_sesiones?: string[];
        };
        Returns: string;
      };
      marcar_factura_pagada: { Args: { p_factura: string; p_fecha?: string }; Returns: undefined };
      reabrir_factura: { Args: { p_factura: string }; Returns: undefined };
      anular_factura: { Args: { p_factura: string; p_motivo: string }; Returns: undefined };
      facturas_totales: {
        Args: {
          p_desde?: string | null;
          p_hasta?: string | null;
          p_emisor?: string | null;
          p_estado?: FacturaEstado | null;
          p_busqueda?: string | null;
          p_paciente?: string | null;
        };
        Returns: { moneda: Moneda; cantidad: number; total: number }[];
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
      factura_estado: FacturaEstado;
    };
    CompositeTypes: Record<string, never>;
  };
};
