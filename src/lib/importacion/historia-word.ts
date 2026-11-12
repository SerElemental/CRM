/**
 * Lee el «Registro de atención psicológica» que Marcela llevaba en Word y lo
 * convierte en las piezas de una historia clínica del CRM.
 *
 * Trabaja sobre el `word/document.xml` del .docx (texto), sin dependencias y
 * sin imports con alias: `scripts/importar-historias.mjs` carga este archivo
 * directamente.
 *
 * La plantilla es siempre la misma: una tabla de identificación, las secciones
 * 1 a 5, «Concepto general», «Plan de trabajo» y «Observaciones», donde cada
 * sesión empieza con un encabezado como «SESIÓN 5 ABRIL 1:». Lo que no se puede
 * resolver con certeza (un año que no está escrito, una sesión sin fecha) no se
 * inventa: queda como aviso para la revisión.
 */

export type ParrafoWord = {
  texto: string;
  /** Texto de las primeras letras en negrita del párrafo («Tarea», «SESIÓN 5 ABRIL 1:»). */
  negrita: string;
  /** Identificadores (`rId…`) de las imágenes que contiene. */
  imagenes: string[];
};

/** Un renglón del archivo original, para mostrarlo al lado en la revisión. `n` = en negrita. */
export type ParrafoOrigen = { t: string; n?: 1 };

export type NotaWord = {
  numero: number;
  encabezado: string;
  fecha: string | null;
  fecha_texto: string | null;
  campos: Record<string, string>;
};

export type HistoriaWord = {
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  identificacion: {
    edad_texto: string | null;
    direccion: string | null;
    seguridad_social: string | null;
    estado_civil: string | null;
    escolaridad: string | null;
    ocupacion: string | null;
    remision: string | null;
    enfermedades: string | null;
    profesional: string | null;
    fecha_consulta: string | null;
    fecha_consulta_texto: string | null;
  };
  secciones: {
    motivo_consulta: string | null;
    antecedentes: string | null;
    nucleo_familiar: string | null;
    relaciones_sociales: string | null;
    relaciones_profesionales: string | null;
    metas_personales: string | null;
    metas_laborales: string | null;
    concepto_general: string | null;
    herramientas_apoyo: string | null;
  };
  objetivos: string[];
  notas: NotaWord[];
  avisos: string[];
  origen: ParrafoOrigen[];
  imagenes: { rId: string; genograma: boolean }[];
};

// ───────────────────────── XML → párrafos ─────────────────────────

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = (t: string) =>
  t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (todo, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : todo;
    }
    return ENTIDADES[e.toLowerCase()] ?? todo;
  });

const esNegrita = (run: string) => /<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(run);

function leerParrafo(xml: string): ParrafoWord {
  let texto = "";
  let negrita = "";
  let sigueNegrita = true;
  for (const run of xml.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    let t = "";
    for (const m of run.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(br|tab|cr)\b[^>]*\/>/g)) {
      t += m[1] != null ? decodificar(m[1]) : m[2] === "tab" ? " " : "\n";
    }
    if (!t) continue;
    texto += t;
    if (sigueNegrita && (esNegrita(run) || !t.trim())) negrita += t;
    else sigueNegrita = false;
  }
  return {
    texto: texto.replace(/[ \t ]+/g, " ").trim(),
    negrita: negrita.replace(/[ \t ]+/g, " ").trim(),
    imagenes: [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]),
  };
}

const parrafosDe = (xml: string) => (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(leerParrafo);

/** Texto de cada celda de la primera tabla (la de identificación), fila por fila. */
function celdasDeIdentificacion(xml: string): string[][] {
  const tabla = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  if (!tabla) return [];
  return (tabla.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((fila) =>
    (fila.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((celda) =>
      parrafosDe(celda).map((p) => p.texto).filter(Boolean).join(" "),
    ),
  );
}

// ───────────────────────── Texto → datos ─────────────────────────

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Para comparar encabezados: sin tildes, sin signos, espacios simples. */
const clave = (t: string) => sinTildes(t).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const limpio = (t: string | undefined | null) => (t ?? "").trim() || null;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre",
];
const RE_MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)";
const numeroDeMes = (m: string) => (m === "setiembre" ? 9 : MESES.indexOf(m) + 1);

function iso(anio: number, mes: number, dia: number): string | null {
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** «Octubre 23 de 2021» o «23 de octubre de 2021» → `2021-10-23`. */
export function fechaDeConsulta(texto: string | null): string | null {
  if (!texto) return null;
  const t = clave(texto);
  const a = t.match(new RegExp(`^${RE_MES} (\\d{1,2})(?: de)? (\\d{4})$`));
  if (a) return iso(Number(a[3]), numeroDeMes(a[1]), Number(a[2]));
  const b = t.match(new RegExp(`^(\\d{1,2})(?: de)? ${RE_MES}(?: de)? (\\d{4})$`));
  if (b) return iso(Number(b[3]), numeroDeMes(b[2]), Number(b[1]));
  return null;
}

/** El encabezado de una sesión tal como está escrito, para separarlo de lo que venga detrás. */
const RE_ENCABEZADO = new RegExp(
  `^\\s*(?:${RE_MES}\\s+\\d{1,2}\\s+)?ses\\s*i?\\s*[oó]n\\s*\\d{1,3}[\\s:.,-]*` +
    `(?:${RE_MES}\\s+\\d{1,2}(?:\\s+(?:de\\s+)?\\d{4})?|\\d{1,2}\\s+(?:de\\s+)?${RE_MES}(?:\\s+(?:de\\s+)?\\d{4})?)?[\\s:.,-]*`,
  "i",
);

type Encabezado = { numero: number; mes: number | null; dia: number | null; anio: number | null; resto: string };

/** «SESIÓN 5 ABRIL 1:», «MAYO 29 SESIÓN 2:», «SESIÓN 4 LA PIERDO POR INASISTENCIA». */
export function encabezadoDeSesion(texto: string): Encabezado | null {
  const t = clave(texto);
  if (t.startsWith("proxima")) return null;
  const m = t.match(new RegExp(`^(?:${RE_MES} (\\d{1,2}) )?sesi?on ?(\\d{1,3})(?: (.*))?$`));
  if (!m) return null;
  let mes = m[1] ? numeroDeMes(m[1]) : null;
  let dia = m[2] ? Number(m[2]) : null;
  let anio: number | null = null;
  let resto = m[4] ?? "";
  const f =
    resto.match(new RegExp(`^${RE_MES} (\\d{1,2})(?:(?: de)? (\\d{4}))?(?: (.*))?$`)) ??
    null;
  const g = f ? null : resto.match(new RegExp(`^(\\d{1,2})(?: de)? ${RE_MES}(?:(?: de)? (\\d{4}))?(?: (.*))?$`));
  if (f) {
    mes = numeroDeMes(f[1]); dia = Number(f[2]); anio = f[3] ? Number(f[3]) : null; resto = f[4] ?? "";
  } else if (g) {
    dia = Number(g[1]); mes = numeroDeMes(g[2]); anio = g[3] ? Number(g[3]) : null; resto = g[4] ?? "";
  }
  return { numero: Number(m[3]), mes, dia, anio, resto: resto.trim() };
}

const ETIQUETAS: { campo: "tarea" | "proxima" | "herramientas"; re: RegExp }[] = [
  { campo: "proxima", re: /^pr[oó]xima\s+sesi[oó]n(?:\s+sesi[oó]n)?\s*:?\s*/i },
  { campo: "tarea", re: /^(?:tareas?|actividad(?:es)?\s+sugeridas?)\s*:\s*/i },
  { campo: "herramientas", re: /^(?:herramientas?\s+de\s+apoyo|libros?)\s*:\s*/i },
];
const ETIQUETAS_SUELTAS: { campo: "tarea" | "proxima" | "herramientas"; re: RegExp }[] = [
  { campo: "proxima", re: /^proxima sesion( sesion)?$/ },
  { campo: "tarea", re: /^(tareas?|actividad(es)? sugeridas?)$/ },
  { campo: "herramientas", re: /^(herramientas? de apoyo|libros?)$/ },
];

/** ¿El párrafo abre «Tarea», «Próxima sesión» o «Herramientas de apoyo»? Devuelve el campo y lo que sigue. */
function etiquetaDe(p: ParrafoWord): { campo: "tarea" | "proxima" | "herramientas"; resto: string } | null {
  for (const e of ETIQUETAS) {
    const m = p.texto.match(e.re);
    if (m) return { campo: e.campo, resto: p.texto.slice(m[0].length).trim() };
  }
  // «Tarea» en negrita y, aparte, el texto: la etiqueta no trae los dos puntos pegados.
  if (p.negrita) {
    const suelta = ETIQUETAS_SUELTAS.find((e) => e.re.test(clave(p.negrita)));
    if (suelta) return { campo: suelta.campo, resto: p.texto.slice(p.negrita.length).replace(/^[\s:]+/, "").trim() };
  }
  return null;
}

const SECCIONES: { re: RegExp; campo: keyof HistoriaWord["secciones"] | "plan" | "observaciones" | "genograma" }[] = [
  { re: /^1 motivo de consulta/, campo: "motivo_consulta" },
  { re: /^2 antecedentes/, campo: "antecedentes" },
  { re: /^3 composicion/, campo: "nucleo_familiar" },
  { re: /^genograma( familiar)?$/, campo: "genograma" },
  { re: /^4 estado actual de las relaciones sociales/, campo: "relaciones_sociales" },
  { re: /^5 estado actual de las relaciones academico/, campo: "relaciones_profesionales" },
  { re: /^metas personales$/, campo: "metas_personales" },
  { re: /^metas laborales$/, campo: "metas_laborales" },
  { re: /^concepto( general)?$/, campo: "concepto_general" },
  { re: /^plan de trabajo$/, campo: "plan" },
  { re: /^observaciones$/, campo: "observaciones" },
];

const IDENTIFICACION: { re: RegExp; campo: string }[] = [
  { re: /^nombre/, campo: "nombre" },
  { re: /^edad/, campo: "edad_texto" },
  { re: /^telefono/, campo: "telefono" },
  { re: /^direccion/, campo: "direccion" },
  { re: /^seguridad social/, campo: "seguridad_social" },
  { re: /^estado civil/, campo: "estado_civil" },
  { re: /^escolaridad/, campo: "escolaridad" },
  { re: /^ocupacion/, campo: "ocupacion" },
  { re: /^remision/, campo: "remision" },
  { re: /^profesional/, campo: "profesional" },
  { re: /^e ?mail|^correo/, campo: "email" },
  { re: /^enfermedades/, campo: "enfermedades" },
  { re: /^fecha de consulta/, campo: "fecha_consulta_texto" },
];

/**
 * Interpreta el `word/document.xml` de una historia. `hoy` (`AAAA-MM-DD`) sirve
 * para avisar de fechas que quedarían en el futuro.
 */
export function interpretarHistoria(xml: string, hoy: string): HistoriaWord {
  const cuerpo = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const avisos: string[] = [];

  // ── Identificación: cada rótulo y, en la celda siguiente, su valor ──
  const id: Record<string, string | null> = {};
  const filas = celdasDeIdentificacion(cuerpo);
  for (const fila of filas) {
    for (let i = 0; i < fila.length; i++) {
      const rotulo = IDENTIFICACION.find((r) => r.re.test(clave(fila[i])));
      if (!rotulo || rotulo.campo in id) continue;
      // Si el valor se escribió en la misma celda («Nombre: Ana»), se toma de ahí.
      const pegado = fila[i].includes(":") ? fila[i].slice(fila[i].indexOf(":") + 1).trim() : "";
      const siguiente = fila[i + 1] ?? "";
      const esOtroRotulo = IDENTIFICACION.some((r) => r.re.test(clave(siguiente)) && siguiente.includes(":"));
      id[rotulo.campo] = limpio(pegado || (esOtroRotulo ? "" : siguiente));
      // La celda del valor ya se usó: no se vuelve a leer como si fuera un rótulo.
      if (!pegado && !esOtroRotulo) i++;
    }
  }
  const fechaConsulta = fechaDeConsulta(id.fecha_consulta_texto ?? null);
  if (!fechaConsulta) {
    avisos.push(
      id.fecha_consulta_texto
        ? `La fecha de consulta está incompleta en el Word («${id.fecha_consulta_texto}»).`
        : "El Word no trae la fecha de consulta.",
    );
  }

  // ── El resto: una máquina de estados sobre los párrafos, en orden ──
  const tablaId = cuerpo.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  const despues = tablaId ? cuerpo.slice((tablaId.index ?? 0) + tablaId[0].length) : cuerpo;
  const parrafos = parrafosDe(despues);

  const textos: Record<string, string[]> = {};
  const objetivos: string[] = [];
  const imagenes: HistoriaWord["imagenes"] = [];
  const notas: NotaWord[] = [];
  const origen: ParrafoOrigen[] = filas.map((f) => ({ t: f.filter(Boolean).join("  ") })).filter((o) => o.t);

  let estado: string | null = null;
  let nota: NotaWord | null = null;
  let cubo: "desarrollo" | "tarea" | "proxima" | "herramientas" = "desarrollo";
  /** Encabezado ya interpretado de cada nota, en el mismo orden que `notas`. */
  const encabezados: Encabezado[] = [];
  /** Texto de «Observaciones» que aparece antes del primer encabezado de sesión. */
  const previo: string[] = [];

  const agregar = (campo: string, texto: string) => {
    if (texto) (textos[campo] ??= []).push(texto);
  };
  const aNota = (texto: string) => {
    if (!nota || !texto) return;
    nota.campos[cubo] = nota.campos[cubo] ? `${nota.campos[cubo]}\n${texto}` : texto;
  };

  for (const p of parrafos) {
    for (const rId of p.imagenes) imagenes.push({ rId, genograma: estado === "genograma" });
    if (!p.texto) continue;
    const k = clave(p.texto);

    const seccion = p.texto.length < 110 ? SECCIONES.find((s) => s.re.test(k)) : undefined;
    if (seccion) {
      estado = seccion.campo;
      nota = null;
      origen.push({ t: p.texto, n: 1 });
      continue;
    }
    origen.push(p.negrita && p.negrita.length >= p.texto.length - 2 ? { t: p.texto, n: 1 } : { t: p.texto });

    if (estado === null) continue; // el título y el texto de presentación de la plantilla
    if (estado === "genograma") { agregar("nucleo_familiar", p.texto); continue; }

    // ¿Empieza una sesión? El encabezado puede ser todo el párrafo o solo su parte en negrita.
    // (Se mira también dentro del plan de trabajo: hay archivos con sesiones escritas ahí.)
    if (estado === "plan" || estado === "observaciones") {
      let enc = p.texto.length <= 90 ? encabezadoDeSesion(p.texto) : null;
      let contenido = "";
      let rotulo = p.texto;
      if (enc && enc.resto.length > 60) enc = null;
      if (!enc && p.negrita && p.negrita.length < p.texto.length) {
        enc = encabezadoDeSesion(p.negrita);
        if (enc && !enc.resto) {
          contenido = p.texto.slice(p.negrita.length).replace(/^[\s:.-]+/, "").trim();
          rotulo = p.negrita;
        } else enc = null;
      }
      if (enc) {
        estado = "observaciones";
        nota = { numero: enc.numero, encabezado: rotulo, fecha: null, fecha_texto: null, campos: {} };
        notas.push(nota);
        encabezados.push(enc);
        cubo = "desarrollo";
        // «SESIÓN 4 LA PIERDO POR INASISTENCIA»: lo que sigue al número es parte del registro.
        const extra = enc.resto ? p.texto.replace(RE_ENCABEZADO, "").replace(/[\s:]+$/, "") : "";
        aNota(extra || contenido);
        continue;
      }
    }

    if (estado === "plan") {
      const e = etiquetaDe(p);
      if (e?.campo === "herramientas") agregar("herramientas_apoyo", p.texto);
      else objetivos.push(p.texto.replace(/[.;]+$/, "").trim());
      continue;
    }

    if (estado === "observaciones") {
      if (!nota) { previo.push(p.texto); continue; }
      const e = etiquetaDe(p);
      if (e) { cubo = e.campo; aNota(e.resto); } else aNota(p.texto);
      continue;
    }

    agregar(estado, p.texto);
  }

  // ── Las sesiones, ya en orden: numeración, huecos y fechas ──
  if (previo.length > 0) {
    const primera = notas.find((n) => n.numero === 1);
    if (primera) {
      primera.campos.desarrollo = [previo.join("\n"), primera.campos.desarrollo].filter(Boolean).join("\n");
      avisos.push("Había texto en «Observaciones» antes del primer encabezado de sesión: quedó al comienzo de la sesión 1.");
    } else {
      notas.push({ numero: 1, encabezado: "(sin encabezado)", fecha: null, fecha_texto: null, campos: { desarrollo: previo.join("\n") } });
      encabezados.push({ numero: 1, mes: null, dia: null, anio: null, resto: "" });
      avisos.push("Había texto en «Observaciones» sin encabezado de sesión: quedó como sesión 1.");
    }
  }
  const enOrden = notas
    .map((n, i) => ({ n, e: encabezados[i], i }))
    .sort((a, b) => a.n.numero - b.n.numero || a.i - b.i);

  let anio = fechaConsulta ? Number(fechaConsulta.slice(0, 4)) : null;
  let mesPrevio = fechaConsulta ? Number(fechaConsulta.slice(5, 7)) : null;
  let anioDeducido = false;
  let sinAnio = 0;
  let anterior = 0;
  for (const { n, e } of enOrden) {
    if (n.numero <= anterior) {
      n.numero = anterior + 1;
      avisos.push(`«${n.encabezado}» quedó como sesión ${n.numero}: en el Word el número estaba repetido.`);
    } else if (n.numero > anterior + 1) {
      const [a, b] = [anterior + 1, n.numero - 1];
      avisos.push(a === b ? `En el Word no aparece la sesión ${a}.` : `En el Word no aparecen las sesiones ${a} a ${b}.`);
    }
    anterior = n.numero;

    if (e.mes && e.dia) {
      n.fecha_texto = `${MESES[e.mes - 1]} ${e.dia}${e.anio ? ` de ${e.anio}` : ""}`;
      if (e.anio) {
        anio = e.anio;
      } else if (anio != null) {
        // Un salto grande hacia atrás (diciembre → enero) es cambio de año; uno corto, un error de digitación.
        if (mesPrevio != null && mesPrevio - e.mes >= 3) anio += 1;
        else if (mesPrevio != null && e.mes < mesPrevio) {
          avisos.push(`La sesión ${n.numero} («${n.fecha_texto}») tiene un mes anterior al de la sesión previa: revisa la fecha.`);
        }
        anioDeducido = true;
      }
      mesPrevio = e.mes;
      if (anio != null) {
        n.fecha = iso(anio, e.mes, e.dia);
        if (!n.fecha) avisos.push(`La fecha de la sesión ${n.numero} («${n.fecha_texto}») no existe en el calendario.`);
      } else sinAnio++;
    } else if (n.numero === 1 && fechaConsulta) {
      n.fecha = fechaConsulta; // la primera sesión es la consulta inicial
    } else {
      avisos.push(`La sesión ${n.numero} no tiene fecha en el Word.`);
    }
  }
  notas.splice(0, notas.length, ...enOrden.map((x) => x.n));

  if (anioDeducido) {
    avisos.push("Las sesiones no traen el año en el Word: se dedujo a partir de la fecha de consulta. Conviene comprobar las fechas.");
  }
  if (sinAnio > 0) {
    avisos.push(`${sinAnio} ${sinAnio === 1 ? "sesión trae" : "sesiones traen"} día y mes pero no hay año de referencia: hay que escribir la fecha completa.`);
  }
  const futuras = notas.filter((n) => n.fecha && n.fecha > hoy);
  if (futuras.length > 0) {
    avisos.push(`${futuras.length === 1 ? "La sesión" : "Las sesiones"} ${futuras.map((n) => n.numero).join(", ")} ${futuras.length === 1 ? "quedó" : "quedaron"} con fecha futura: revisa el año.`);
  }

  const texto = (campo: string) => limpio(textos[campo]?.join("\n"));
  return {
    nombre: id.nombre ?? null,
    telefono: id.telefono ?? null,
    email: id.email ?? null,
    identificacion: {
      edad_texto: id.edad_texto ?? null,
      direccion: id.direccion ?? null,
      seguridad_social: id.seguridad_social ?? null,
      estado_civil: id.estado_civil ?? null,
      escolaridad: id.escolaridad ?? null,
      ocupacion: id.ocupacion ?? null,
      remision: id.remision ?? null,
      enfermedades: id.enfermedades ?? null,
      profesional: id.profesional ?? null,
      fecha_consulta: fechaConsulta,
      fecha_consulta_texto: fechaConsulta ? null : (id.fecha_consulta_texto ?? null),
    },
    secciones: {
      motivo_consulta: texto("motivo_consulta"),
      antecedentes: texto("antecedentes"),
      nucleo_familiar: texto("nucleo_familiar"),
      relaciones_sociales: texto("relaciones_sociales"),
      relaciones_profesionales: texto("relaciones_profesionales"),
      metas_personales: texto("metas_personales"),
      metas_laborales: texto("metas_laborales"),
      concepto_general: texto("concepto_general"),
      herramientas_apoyo: texto("herramientas_apoyo"),
    },
    objetivos: objetivos.filter(Boolean),
    notas,
    avisos,
    origen,
    imagenes,
  };
}

// ───────────────────────── Emparejar con el paciente ─────────────────────────

/** «Juan Diego Dîaz » → `juan diego diaz`. */
export const normalizarNombre = (nombre: string) => clave(nombre.replace(/\.docx$/i, ""));

/**
 * Busca el paciente del CRM al que corresponde un nombre del Word. Coincide si
 * el nombre es igual o si todas las palabras del más corto están en el más
 * largo («Kevin Torres» ↔ «Kevin Andrés Torres Gómez»). Si hay varios
 * candidatos y no se puede elegir, devuelve la lista para resolverlo a mano.
 */
export function emparejarPaciente<P extends { id: string; nombre_completo: string; estado: string }>(
  nombre: string, pacientes: P[],
): { paciente: P | null; candidatos: P[] } {
  const buscado = normalizarNombre(nombre);
  const palabras = buscado.split(" ").filter(Boolean);
  if (palabras.length === 0) return { paciente: null, candidatos: [] };

  const exactos = pacientes.filter((p) => normalizarNombre(p.nombre_completo) === buscado);
  const elegir = (lista: P[]) => {
    if (lista.length === 1) return lista[0];
    const activos = lista.filter((p) => p.estado === "activo");
    return activos.length === 1 ? activos[0] : null;
  };
  if (exactos.length > 0) return { paciente: elegir(exactos), candidatos: exactos };
  if (palabras.length < 2) return { paciente: null, candidatos: [] };

  const parciales = pacientes.filter((p) => {
    const otras = normalizarNombre(p.nombre_completo).split(" ").filter(Boolean);
    const [corto, largo] = palabras.length <= otras.length ? [palabras, otras] : [otras, palabras];
    return corto.length >= 2 && corto.every((w) => largo.includes(w));
  });
  return { paciente: elegir(parciales), candidatos: parciales };
}
