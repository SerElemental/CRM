import { describe, expect, it } from "vitest";
import {
  esMarca, interpretarContacto, interpretarGrupo, limpiarComentario, mapearCasilla,
  normalizarEstado, normalizarPlanTrabajo, parsearFecha, parsearValor,
} from "./mapeo";

const c = (valor: unknown, relleno: "amarillo" | "rojo" | "ninguno", extra = {}) =>
  mapearCasilla({ valor, relleno, ...extra });

describe("mapearCasilla", () => {
  it("casilla vacía no es una sesión", () => {
    expect(c(null, "ninguno")).toBeNull();
    expect(c("  ", "ninguno")).toBeNull();
  });

  it.each([
    [null, "amarillo", "realizada", "pagada"],
    ["a", "amarillo", "realizada", "paquete"],
    ["A", "amarillo", "realizada", "paquete"],
    ["s", "amarillo", "realizada", "pagada"],
    ["s", "ninguno", "realizada", "sin_pagar"],
    ["S", "ninguno", "realizada", "sin_pagar"],
    ["a", "ninguno", "pendiente", "paquete"],
    ["a", "rojo", "perdida", "paquete"],
    [null, "rojo", "perdida", "no_aplica"],
  ] as const)("%s + %s → %s / %s", (valor, relleno, asistencia, pago) => {
    expect(c(valor, relleno)).toEqual({ asistencia, pago, nota: null, revisar: false });
  });

  it("en una fila toda roja el rojo no cuenta: solo las letras", () => {
    expect(c(null, "rojo", { filaRoja: true })).toBeNull();
    expect(c("s", "rojo", { filaRoja: true })).toMatchObject({ asistencia: "realizada", pago: "sin_pagar" });
    expect(c("a", "rojo", { filaRoja: true })).toMatchObject({ asistencia: "pendiente", pago: "paquete" });
  });

  it("el comentario de la celda pasa a la nota", () => {
    expect(c(null, "rojo", { comentario: "Microsoft Office User:\nno asiste, avisa una hora antes" })).toEqual({
      asistencia: "perdida", pago: "no_aplica", nota: "no asiste, avisa una hora antes", revisar: false,
    });
  });

  it("valores fuera del código quedan marcados para revisar", () => {
    expect(c("abona 50", "amarillo")).toEqual({
      asistencia: "realizada", pago: "pagada", nota: "[Revisar] Excel: «abona 50»", revisar: true,
    });
    expect(c("ax", "rojo")).toMatchObject({ asistencia: "perdida", pago: "paquete", revisar: true });
    expect(c(70, "amarillo")).toMatchObject({ asistencia: "realizada", pago: "pagada", revisar: true });
  });

  it("un comentario suelto que no habla de inasistencia no es una sesión", () => {
    expect(c(null, "ninguno", { comentario: "saldo a favor 2.000" })).toBeNull();
    expect(c(null, "ninguno", { comentario: "abona 70 pendiente 5 mil" })).toBeNull();
  });

  it("una casilla con solo un comentario de inasistencia se importa como perdida a revisar", () => {
    expect(c(null, "ninguno", { comentario: "multa por inasistencia" })).toEqual({
      asistencia: "perdida", pago: "no_aplica", nota: "[Revisar] multa por inasistencia", revisar: true,
    });
  });
});

describe("parsearValor", () => {
  it("pesos y dólares", () => {
    expect(parsearValor(93000)).toEqual({ valor: 93000, moneda: "COP", revisar: false });
    expect(parsearValor("130 USD")).toEqual({ valor: 130, moneda: "USD", revisar: false });
    expect(parsearValor("120 usd")).toEqual({ valor: 120, moneda: "USD", revisar: false });
    expect(parsearValor("19,99 USD")).toMatchObject({ valor: 19.99, moneda: "USD" });
  });
  it("corrige la O por cero y avisa", () => {
    expect(parsearValor("4O USD")).toEqual({ valor: 40, moneda: "USD", revisar: true });
  });
  it("un número pequeño sin moneda se toma como USD, a revisar", () => {
    expect(parsearValor(200)).toEqual({ valor: 200, moneda: "USD", revisar: true });
  });
  it("vacío o ilegible → null", () => {
    expect(parsearValor(null)).toBeNull();
    expect(parsearValor("")).toBeNull();
    expect(parsearValor("91000 - 83000")).toBeNull();
  });
});

describe("parsearFecha", () => {
  it.each([
    ["Mayo 2 de 2023", "2023-05-02"],
    ["Junio 18 2022", "2022-06-18"],
    ["Enero 23 DEL 2026", "2026-01-23"],
    ["Mayo 10 DE 2024", "2024-05-10"],
    ["Septiembre 25 d e 2023", "2023-09-25"],
    ["Julio 20 del 2024", "2024-07-20"],
    ["Sep 10 2020", "2020-09-10"],
  ])("%s → %s", (entrada, fecha) => {
    expect(parsearFecha(entrada)).toEqual({ fecha, texto: null });
  });
  it("fechas reales y números de serie de Excel", () => {
    expect(parsearFecha(new Date(Date.UTC(2020, 11, 1)))).toEqual({ fecha: "2020-12-01", texto: null });
    expect(parsearFecha(44896)).toEqual({ fecha: "2022-12-01", texto: null });
  });
  it("lo que no se entiende se conserva como texto", () => {
    for (const t of ["Enero de 2024", "Abirl 2024", "Agosto 26 20221", "Junio 27 de 2020 - Abril 12 de 2023"]) {
      expect(parsearFecha(t)).toEqual({ fecha: null, texto: t });
    }
    expect(parsearFecha(null)).toEqual({ fecha: null, texto: null });
  });
});

describe("datos del paciente", () => {
  it("estado", () => {
    expect(normalizarEstado("iNACTIVO").estado).toBe("inactivo");
    expect(normalizarEstado("INACTIVO SIN PAGAR").estado).toBe("inactivo_sin_pagar");
    expect(normalizarEstado("REMITIDA TLP")).toMatchObject({ estado: "remitido", nota: "Estado en Excel: REMITIDA TLP" });
    expect(normalizarEstado(null)).toMatchObject({ estado: "inactivo", revisar: true });
  });
  it("grupo de WhatsApp / tipo de paciente", () => {
    expect(interpretarGrupo("pacientes")).toEqual({ grupo: "Pacientes", tipo: null, nota: null });
    expect(interpretarGrupo("Pacientes 2").grupo).toBe("Pacientes 2");
    expect(interpretarGrupo("Niño")).toEqual({ grupo: null, tipo: "nino", nota: null });
    expect(interpretarGrupo("Sin WH")).toEqual({ grupo: null, tipo: null, nota: null });
    expect(interpretarGrupo("Con otra psicologo").nota).toBe("Con otra psicologo");
  });
  it("contacto", () => {
    expect(interpretarContacto(3148204759).telefono).toBe("3148204759");
    expect(interpretarContacto("+1 (831) 430-8837").telefono).toBe("+1 (831) 430-8837");
    expect(interpretarContacto("Pareja")).toEqual({ telefono: null, tipo: "pareja", nota: null });
    expect(interpretarContacto("A través de un familiar").nota).toBe("Contacto: A través de un familiar");
    expect(interpretarContacto("Sin contacto").telefono).toBeNull();
  });
  it("marcas con X y plan de trabajo", () => {
    expect(esMarca("X")).toEqual({ marcado: true, revisar: false });
    expect(esMarca("elia")).toEqual({ marcado: true, revisar: true });
    expect(esMarca(null).marcado).toBe(false);
    expect(normalizarPlanTrabajo("si").plan).toBe("si");
    expect(normalizarPlanTrabajo("NA").plan).toBe("no_aplica");
    expect(normalizarPlanTrabajo("Biodescodificación")).toEqual({ plan: null, nota: "Plan de trabajo: Biodescodificación" });
  });
  it("comentarios", () => {
    expect(limpiarComentario("Usuario:\nMulta de 10 mil por pagar")).toBe("Multa de 10 mil por pagar");
    expect(limpiarComentario("  ")).toBeNull();
  });
});
