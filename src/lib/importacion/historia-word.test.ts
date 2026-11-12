import { describe, expect, it } from "vitest";
import { emparejarPaciente, encabezadoDeSesion, fechaDeConsulta, interpretarHistoria } from "./historia-word";

// ── Un .docx mínimo, armado a mano con la misma forma de la plantilla ──
const r = (texto: string, negrita = false) =>
  `<w:r>${negrita ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${texto}</w:t></w:r>`;
const p = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;
const celda = (...parrafos: string[]) => `<w:tc>${parrafos.join("")}</w:tc>`;
const fila = (...celdas: string[]) => `<w:tr>${celdas.join("")}</w:tr>`;
const tabla = (...filas: string[]) => `<w:tbl>${filas.join("")}</w:tbl>`;
const dato = (rotulo: string, valor: string) => [celda(p(r(rotulo, true))), celda(p(r(valor)))];
const bloque = (titulo: string, ...contenido: string[]) =>
  tabla(fila(celda(p(r(titulo, true)))), fila(celda(...contenido)));

const documento = (consulta: string, observaciones: string[]) => `<w:document><w:body>
  ${p(r("REGISTRO DE ATENCIÓN PSICOLÓGICA", true))}
  ${p(r("Texto de presentación de la plantilla."))}
  ${tabla(
    fila(...dato("Nombre:", "Ana Ejemplo"), ...dato("Edad:", "34 años"), ...dato("Teléfono:", "300 555 0142")),
    fila(...dato("Dirección:", "Medellín"), ...dato("Seguridad Social:", "EPS")),
    fila(...dato("Estado Civil:", "Unión libre"), ...dato("Escolaridad", "Profesional"), ...dato("Ocupación:", "Diseñadora")),
    fila(...dato("Remisión:", "No"), ...dato("Profesional que atiende:", "Marcela Salazar")),
    fila(...dato("E mail:", "ana@correo.co"), ...dato("Enfermedades:", "")),
    fila(...dato("Fecha de consulta:", consulta)),
  )}
  ${bloque("1. Motivo de Consulta", p(r("Dificultad para poner límites.")), p(r("Cansancio constante.")))}
  ${bloque("2. Antecedentes Clínicos o terapéuticos", p(r("Proceso anterior en 2021 &amp; sin medicación.")))}
  ${bloque("3. Composición del Núcleo Familiar y Relación con cada uno de ellos", p(r("Hermana mayor de tres.")))}
  ${p(r("Genograma Familiar", true))}
  ${p(`<w:r><w:drawing><a:blip r:embed="rId9"/></w:drawing></w:r>`)}
  ${bloque("4. Estado actual de las Relaciones Sociales (Pareja, Amigos, Ocio)", p(r("")))}
  ${tabla(
    fila(celda(p(r("5. Estado actual de las Relaciones Académico-Profesionales", true)))),
    fila(celda(p(r("Trabaja en una agencia.")))),
    fila(celda(p(r("Metas Personales", true)))), fila(celda(p(r("Retomar la pintura.")))),
    fila(celda(p(r("Metas Laborales", true)))), fila(celda(p(r("")))),
  )}
  ${tabla(
    fila(celda(p(r("CONCEPTO GENERAL", true)))), fila(celda(p(r("Buena disposición "), r("al proceso.")))),
    fila(celda(p(r("Pla", true), r("n de trabajo", true)))),
    fila(celda(
      p(r("Sanar vínculos familiares")), p(r("Proyecto de vida.")),
      p(r("Herramientas de apoyo: ", true), r("guía de amor propio")),
    )),
  )}
  ${bloque("OBSERVACIONES", ...observaciones)}
</w:body></w:document>`;

const completo = documento("Octubre 23 de 2025", [
  p(r("SESION", true), r(" 1:")),
  p(r("Se indaga motivo de consulta.")),
  p(r("Proxima", true), r(" sesión", true), r(": presentar propuesta de trabajo")),
  p(r("Carta a su pareja.")),
  p(r("Tarea", true), r(": video introductorio")),
  p(r("SESIÓN 2 NOVIEMBRE 6:", true)),
  p(r("Se trabaja el eneagrama.")),
  p(r("ACTIVIDAD SUGERIDA:", true)),
  p(r("Identificar su eneatipo")),
  p(r("PRÓXIMA SESIÓN:", true)),
  p(r("Revisar tareas")),
  p(r("SESIÓN 3 ", true), r("LA PIERDO POR INASISTENCIA", true)),
  p(r("ENERO 15 SESIÓN 4", true), r(":")),
  p(r("Vuelve después de vacaciones.")),
  p(r("SESIÓN 4 ENERO 29:", true)),
  p(r("Se revisa el proyecto de vida.")),
  p(r("SESIÓN 9", true)),
  p(r("Sin fecha.")),
]);

describe("historia en Word", () => {
  const h = interpretarHistoria(completo, "2026-11-11");

  it("lee la tabla de identificación, con o sin dos puntos en el rótulo", () => {
    expect(h.nombre).toBe("Ana Ejemplo");
    expect(h.telefono).toBe("300 555 0142");
    expect(h.email).toBe("ana@correo.co");
    expect(h.identificacion).toEqual({
      edad_texto: "34 años", direccion: "Medellín", seguridad_social: "EPS", estado_civil: "Unión libre",
      escolaridad: "Profesional", ocupacion: "Diseñadora", remision: "No", enfermedades: null,
      profesional: "Marcela Salazar", fecha_consulta: "2025-10-23", fecha_consulta_texto: null,
    });
  });

  it("separa las secciones, las metas, el concepto y el plan", () => {
    expect(h.secciones).toEqual({
      motivo_consulta: "Dificultad para poner límites.\nCansancio constante.",
      antecedentes: "Proceso anterior en 2021 & sin medicación.",
      nucleo_familiar: "Hermana mayor de tres.",
      relaciones_sociales: null,
      relaciones_profesionales: "Trabaja en una agencia.",
      metas_personales: "Retomar la pintura.",
      metas_laborales: null,
      concepto_general: "Buena disposición al proceso.",
      herramientas_apoyo: "Herramientas de apoyo: guía de amor propio",
    });
    expect(h.objetivos).toEqual(["Sanar vínculos familiares", "Proyecto de vida"]);
    expect(h.imagenes).toEqual([{ rId: "rId9", genograma: true }]);
  });

  it("convierte «Observaciones» en una nota por sesión, con tarea y próxima sesión aparte", () => {
    expect(h.notas.map((n) => [n.numero, n.fecha, n.fecha_texto])).toEqual([
      [1, "2025-10-23", null],          // sin fecha: es la consulta inicial
      [2, "2025-11-06", "noviembre 6"],
      [3, null, null],
      [4, "2026-01-15", "enero 15"],    // enero después de noviembre: cambia el año
      [5, "2026-01-29", "enero 29"],    // el Word repetía «SESIÓN 4»
      [9, null, null],
    ]);
    expect(h.notas[0].campos).toEqual({
      desarrollo: "Se indaga motivo de consulta.",
      proxima: "presentar propuesta de trabajo\nCarta a su pareja.",
      tarea: "video introductorio",
    });
    expect(h.notas[1].campos).toEqual({
      desarrollo: "Se trabaja el eneagrama.", tarea: "Identificar su eneatipo", proxima: "Revisar tareas",
    });
    expect(h.notas[2].campos).toEqual({ desarrollo: "LA PIERDO POR INASISTENCIA" });
    expect(h.notas[4].encabezado).toBe("SESIÓN 4 ENERO 29:");
  });

  it("avisa de lo que no pudo resolver sola, sin inventarlo", () => {
    expect(h.avisos).toEqual([
      "La sesión 3 no tiene fecha en el Word.",
      "«SESIÓN 4 ENERO 29:» quedó como sesión 5: en el Word el número estaba repetido.",
      "En el Word no aparecen las sesiones 6 a 8.",
      "La sesión 9 no tiene fecha en el Word.",
      "Las sesiones no traen el año en el Word: se dedujo a partir de la fecha de consulta. Conviene comprobar las fechas.",
    ]);
  });

  it("guarda el texto original para compararlo en la revisión", () => {
    expect(h.origen[0]).toEqual({ t: "Nombre:  Ana Ejemplo  Edad:  34 años  Teléfono:  300 555 0142" });
    expect(h.origen).toContainEqual({ t: "OBSERVACIONES", n: 1 });
    expect(h.origen).toContainEqual({ t: "Se trabaja el eneagrama." });
    expect(h.origen.at(-1)).toEqual({ t: "Sin fecha." });
  });

  it("sin año de referencia no pone fechas a las sesiones", () => {
    const s = interpretarHistoria(documento("de 2026", [p(r("SESIÓN 1", true)), p(r("Inicio.")), p(r("SESIÓN 2 MARZO 3:", true)), p(r("Sigue."))]), "2026-11-11");
    expect(s.identificacion.fecha_consulta).toBeNull();
    expect(s.identificacion.fecha_consulta_texto).toBe("de 2026");
    expect(s.notas.map((n) => [n.numero, n.fecha, n.fecha_texto])).toEqual([[1, null, null], [2, null, "marzo 3"]]);
    expect(s.avisos).toEqual([
      "La fecha de consulta está incompleta en el Word («de 2026»).",
      "La sesión 1 no tiene fecha en el Word.",
      "1 sesión trae día y mes pero no hay año de referencia: hay que escribir la fecha completa.",
    ]);
  });

  it("ordena las sesiones aunque el Word las traiga desordenadas o dentro del plan de trabajo", () => {
    const xml = documento("Marzo 3 de 2025", [
      p(r("Texto suelto antes de la primera sesión.")),
      p(r("SESIÓN 2 MARZO 17:", true)), p(r("Segunda.")),
      p(r("SESIÓN 1", true)), p(r("Primera.")),
      p(r("SESIÓN 3 FEBRERO 28:", true)), p(r("Tercera, con el mes mal escrito.")),
    ]).replace(
      p(r("Proyecto de vida.")),
      p(r("Proyecto de vida.")) + p(r("SESION 4 ABRIL 7:", true)) + p(r("Cuarta, escrita dentro del plan.")),
    );
    const s = interpretarHistoria(xml, "2026-11-11");
    expect(s.objetivos).toEqual(["Sanar vínculos familiares", "Proyecto de vida"]);
    expect(s.notas.map((n) => [n.numero, n.fecha, n.campos.desarrollo])).toEqual([
      [1, "2025-03-03", "Texto suelto antes de la primera sesión.\nPrimera."],
      [2, "2025-03-17", "Segunda."],
      [3, "2025-02-28", "Tercera, con el mes mal escrito."],
      [4, "2025-04-07", "Cuarta, escrita dentro del plan."],
    ]);
    expect(s.notas[3].campos.herramientas).toBe("guía de amor propio");
    expect(s.avisos).toContain("La sesión 3 («febrero 28») tiene un mes anterior al de la sesión previa: revisa la fecha.");
    expect(s.avisos).toContain("Había texto en «Observaciones» antes del primer encabezado de sesión: quedó al comienzo de la sesión 1.");
  });

  it("avisa cuando una fecha deducida queda en el futuro", () => {
    const s = interpretarHistoria(documento("Octubre 28 de 2026", [p(r("SESIÓN 1", true)), p(r("Inicio.")), p(r("SESIÓN 2 ENERO 12:", true)), p(r("Sigue."))]), "2026-11-11");
    expect(s.notas[1].fecha).toBe("2027-01-12");
    expect(s.avisos).toContain("La sesión 2 quedó con fecha futura: revisa el año.");
  });
});

describe("fechas y encabezados", () => {
  it("entiende las dos formas de escribir la fecha de consulta", () => {
    expect(fechaDeConsulta("Octubre 23 de 2021")).toBe("2021-10-23");
    expect(fechaDeConsulta("4 de julio de 2026")).toBe("2026-07-04");
    expect(fechaDeConsulta("Febrero 30 de 2026")).toBeNull();
    expect(fechaDeConsulta("de 2026")).toBeNull();
  });

  it("reconoce los encabezados de sesión y no confunde «Próxima sesión»", () => {
    expect(encabezadoDeSesion("SESIÓN 18  SEPTIEMBRE 25:")).toEqual({ numero: 18, mes: 9, dia: 25, anio: null, resto: "" });
    expect(encabezadoDeSesion("MAYO 29 SESIÓN 2:")).toEqual({ numero: 2, mes: 5, dia: 29, anio: null, resto: "" });
    expect(encabezadoDeSesion("Sesión 15 SEPTIEMBRE 4 de 2025:")).toEqual({ numero: 15, mes: 9, dia: 4, anio: 2025, resto: "" });
    expect(encabezadoDeSesion("SESIÓN 4 LA PIERDO POR INASISTENCIA")?.resto).toBe("la pierdo por inasistencia");
    expect(encabezadoDeSesion("Próxima sesión: revisar tareas")).toBeNull();
    expect(encabezadoDeSesion("Se revisa la sesión 3")).toBeNull();
  });
});

describe("emparejar con el paciente", () => {
  const pacientes = [
    { id: "1", nombre_completo: "Kevin Andrés Torres Gómez", estado: "activo" },
    { id: "2", nombre_completo: "Diego Alexander Torres", estado: "activo" },
    { id: "3", nombre_completo: "Laura Lozano", estado: "inactivo" },
    { id: "4", nombre_completo: "Laura Lozano", estado: "activo" },
    { id: "5", nombre_completo: "Juan Díaz", estado: "activo" },
    { id: "6", nombre_completo: "Juan Pablo Díaz", estado: "activo" },
  ];
  it("coincide por nombre igual o contenido, sin tildes ni espacios de más", () => {
    expect(emparejarPaciente("Kevin Torres .docx", pacientes).paciente?.id).toBe("1");
    expect(emparejarPaciente("Diego Alexander Torres", pacientes).paciente?.id).toBe("2");
  });
  it("entre homónimos prefiere al activo; si no puede elegir, devuelve los candidatos", () => {
    expect(emparejarPaciente("Laura Lozano", pacientes).paciente?.id).toBe("4");
    const dudoso = emparejarPaciente("Juan Diego Dîaz", pacientes);
    expect(dudoso.paciente?.id).toBe("5");
    const varios = emparejarPaciente("Juan Díaz Pérez", pacientes);
    expect(varios.paciente?.id).toBe("5");
    expect(emparejarPaciente("Nadie Conocido", pacientes)).toEqual({ paciente: null, candidatos: [] });
  });
});
