#!/usr/bin/env node
/**
 * Importa «Registro pacientes Mayo 2026.xlsx» al CRM.
 *
 * Uso:
 *   node scripts/importar-excel.mjs --dry-run            # solo analiza y muestra el resumen
 *   npm run importar                                     # importa (base vacía)
 *   npm run importar -- --forzar                         # vuelve a importar encima
 *   npm run importar -- "/ruta/a/otro.xlsx"
 *
 * El Excel tiene datos de pacientes: vive FUERA del repositorio (por defecto se
 * busca en la carpeta de arriba). El reporte para revisar queda en `reportes/`,
 * que tampoco se versiona.
 *
 * La importación es repetible: la clave de cada paciente es su fila en el Excel
 * (`excel_fila`). Si la base ya tiene pacientes exige `--forzar`, porque volver
 * a importar sobrescribe lo que se haya editado en el CRM.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  esMarca, interpretarContacto, interpretarGrupo, limpiarComentario, mapearCasilla, normalizarEstado,
  normalizarModalidad, normalizarPlanTrabajo, parsearFecha, parsearValor,
} from "../src/lib/importacion/mapeo.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORZAR = args.includes("--forzar");
const archivo = resolve(
  args.find((a) => !a.startsWith("--")) ?? join(raiz, "..", "Registro pacientes Mayo 2026.xlsx"),
);

// Columnas del Excel (1 = A).
const COL = {
  numero: 1, nombre: 2, pais: 3, grupo: 4, membresia: 5, correoMembresia: 6, planMembresia: 7,
  contacto: 8, email: 9, flyer: 10, estado: 11, modalidad: 12, planTrabajo: 13,
  consentimiento: 14, ultimaSesion: 15, /* 16 = seguimiento antiguo: se descarta */
  fechaInicio: 17, valor2026: 18, valor2025: 19, /* 20–22 = valores 2024 y anteriores: se descartan */
  primeraSesion: 23, ultimaSesionCol: 122,
};
const PRIMERA_FILA = 3;

if (!existsSync(archivo)) {
  console.error(`❌ No encuentro el Excel en:\n   ${archivo}\n   Pásalo como argumento: npm run importar -- "/ruta/al/archivo.xlsx"`);
  process.exit(1);
}

// ───────────────────────── Lectura de celdas ─────────────────────────
/** Valor plano de una celda (texto enriquecido, fórmulas e hipervínculos incluidos). */
function valor(celda) {
  const v = celda.value;
  if (v == null) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return v.result ?? null;
    if ("text" in v) return v.text;
  }
  return String(v);
}

function comentario(celda) {
  const n = celda.note;
  if (!n) return null;
  if (typeof n === "string") return n;
  if (Array.isArray(n.texts)) return n.texts.map((t) => t.text).join("");
  return null;
}

/** Solo dos colores significan algo: amarillo puro y rojo puro. */
function relleno(celda) {
  const f = celda.fill;
  if (!f || f.type !== "pattern" || !f.pattern || f.pattern === "none") return "ninguno";
  const argb = f.fgColor?.argb?.toUpperCase();
  if (argb === "FFFFFF00") return "amarillo";
  if (argb === "FFFF0000") return "rojo";
  return "ninguno";
}

const limpio = (v) => {
  const t = v == null ? "" : String(v).trim();
  return t === "" ? null : t;
};

// ───────────────────────── Análisis ─────────────────────────
const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(archivo);
const hoja = libro.worksheets[0];

const pacientes = [];
const revisar = []; // { fila, nombre, asunto }
const conteo = {};
const suma = (k, n = 1) => (conteo[k] = (conteo[k] ?? 0) + n);

for (let f = PRIMERA_FILA; f <= hoja.rowCount; f++) {
  const fila = hoja.getRow(f);
  const nombre = limpio(valor(fila.getCell(COL.nombre)));
  if (!nombre) continue;

  const anotar = (asunto) => revisar.push({ fila: f, nombre, asunto });
  const notas = [];

  // Fila roja = no volver a contactar.
  const rellenoNombre = relleno(fila.getCell(COL.nombre));
  let rojas = 0;
  for (let c = COL.primeraSesion; c <= COL.ultimaSesionCol; c++) if (relleno(fila.getCell(c)) === "rojo") rojas++;
  const filaRoja = rellenoNombre === "rojo" || rojas >= 90;
  if (rellenoNombre === "amarillo") {
    notas.push("Nombre resaltado en amarillo en el Excel");
    anotar("Nombre resaltado en amarillo: confirmar qué significa");
  }

  const grupo = interpretarGrupo(valor(fila.getCell(COL.grupo)));
  const contacto = interpretarContacto(valor(fila.getCell(COL.contacto)));
  const estado = normalizarEstado(valor(fila.getCell(COL.estado)));
  const plan = normalizarPlanTrabajo(valor(fila.getCell(COL.planTrabajo)));
  const inicio = parsearFecha(valor(fila.getCell(COL.fechaInicio)));
  const ultima = parsearFecha(valor(fila.getCell(COL.ultimaSesion)));
  const miembro = esMarca(valor(fila.getCell(COL.membresia)));
  const correo = esMarca(valor(fila.getCell(COL.correoMembresia)));
  const flyer = esMarca(valor(fila.getCell(COL.flyer)));
  const consentimiento = limpio(valor(fila.getCell(COL.consentimiento)));
  const planMembresia = parsearValor(valor(fila.getCell(COL.planMembresia)));

  let pais = limpio(valor(fila.getCell(COL.pais)));
  if (pais && /^sin wh/i.test(pais)) pais = null;

  if (grupo.nota && grupo.nota !== "Sin contacto") notas.push(`Grupo de WhatsApp: ${grupo.nota}`);
  if (contacto.nota) notas.push(contacto.nota);
  if (estado.nota) notas.push(estado.nota);
  if (plan.nota) notas.push(plan.nota);
  if (ultima.texto) notas.push(`Última sesión (Excel): ${ultima.texto}`);
  if (estado.revisar) anotar(`Estado: ${estado.nota}`);
  if (inicio.texto) anotar(`Fecha de inicio sin interpretar: «${inicio.texto}»`);
  if (miembro.revisar) anotar(`Columna Membresía con texto: «${valor(fila.getCell(COL.membresia))}»`);

  const tipo = grupo.tipo ?? contacto.tipo ?? (/\sy\s|\s[–-]\s/i.test(nombre) ? "pareja" : "individual");

  // Tarifas 2026 y 2025.
  const tarifas = [];
  for (const [anio, col] of [[2026, COL.valor2026], [2025, COL.valor2025]]) {
    const crudo = valor(fila.getCell(col));
    const t = parsearValor(crudo);
    if (t) {
      tarifas.push({ anio, valor: t.valor, moneda: t.moneda });
      if (t.revisar) anotar(`Valor ${anio} corregido: «${crudo}» → ${t.valor} ${t.moneda}`);
    } else if (limpio(crudo)) {
      notas.push(`Valor ${anio} (Excel): ${crudo}`);
      anotar(`Valor ${anio} sin interpretar: «${crudo}»`);
    }
  }

  // Sesiones: el número de sesión es la posición de la columna.
  const sesiones = [];
  for (let c = COL.primeraSesion; c <= COL.ultimaSesionCol; c++) {
    const celda = fila.getCell(c);
    const s = mapearCasilla({
      valor: valor(celda), relleno: relleno(celda), comentario: comentario(celda), filaRoja,
    });
    const numero = c - COL.primeraSesion + 1;
    if (!s) {
      // Comentario suelto (saldo a favor, abono…): no es una sesión, va a las notas.
      const suelto = limpiarComentario(comentario(celda));
      if (suelto) {
        notas.push(`Casilla de la sesión ${numero} (Excel): ${suelto}`);
        anotar(`Comentario en la casilla ${numero}, sin sesión: ${suelto}`);
      }
      continue;
    }
    sesiones.push({ numero, asistencia: s.asistencia, pago: s.pago, nota: s.nota });
    suma(`${s.asistencia} / ${s.pago}`);
    if (s.revisar) anotar(`Sesión ${numero}: ${s.nota}`);
  }

  if (filaRoja && sesiones.length) {
    anotar(
      `Fila roja con ${sesiones.length} sesiones marcadas con letra: el color rojo tapa el historial anterior, confirmar cuántas sesiones tuvo`,
    );
  }

  const motivo = filaRoja
    ? (grupo.nota ?? "Marcado en rojo en el Excel")
    : null;

  pacientes.push({
    fila: {
      excel_fila: f,
      numero: typeof valor(fila.getCell(COL.numero)) === "number" ? valor(fila.getCell(COL.numero)) : null,
      nombre_completo: nombre,
      tipo,
      pais,
      telefono: contacto.telefono,
      email: limpio(valor(fila.getCell(COL.email)))?.toLowerCase() ?? null,
      estado: estado.estado,
      modalidad: normalizarModalidad(valor(fila.getCell(COL.modalidad))),
      fecha_inicio: inicio.fecha,
      fecha_inicio_texto: inicio.texto,
      ultima_sesion: ultima.fecha,
      plan_trabajo_enviado: plan.plan,
      consentimiento: consentimiento?.toLowerCase() === "si",
      es_miembro: miembro.marcado,
      correo_membresia_enviado: correo.marcado,
      flyer_enviado: flyer.marcado,
      no_contactar: filaRoja,
      no_contactar_motivo: motivo,
      notas: notas.length ? notas.join("\n") : null,
    },
    grupo: grupo.grupo,
    precioPlan: planMembresia?.valor ?? null,
    tarifas,
    sesiones,
  });
}

// Los pacientes sin número reciben el siguiente consecutivo.
let siguiente = Math.max(0, ...pacientes.map((p) => p.fila.numero ?? 0)) + 1;
for (const p of pacientes) if (p.fila.numero == null) p.fila.numero = siguiente++;

// Nombres repetidos.
const vistos = new Map();
for (const p of pacientes) {
  const k = p.fila.nombre_completo.toLowerCase();
  if (vistos.has(k)) {
    revisar.push({
      fila: p.fila.excel_fila, nombre: p.fila.nombre_completo,
      asunto: `Nombre repetido (también en la fila ${vistos.get(k)}): ¿es la misma persona?`,
    });
  } else vistos.set(k, p.fila.excel_fila);
}

// ───────────────────────── Resumen ─────────────────────────
const cuenta = (fn) => pacientes.filter(fn).length;
const totalSesiones = pacientes.reduce((n, p) => n + p.sesiones.length, 0);
const porEstado = {};
for (const p of pacientes) porEstado[p.fila.estado] = (porEstado[p.fila.estado] ?? 0) + 1;

const resumen = [
  `Pacientes:                 ${pacientes.length}`,
  `  por estado:              ${Object.entries(porEstado).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
  `  no volver a contactar:   ${cuenta((p) => p.fila.no_contactar)}`,
  `  miembros:                ${cuenta((p) => p.fila.es_miembro)}`,
  `  correo de membresía:     ${cuenta((p) => p.fila.correo_membresia_enviado)}`,
  `  con plan de membresía:   ${cuenta((p) => p.precioPlan != null)}`,
  `  flyer de seguimiento:    ${cuenta((p) => p.fila.flyer_enviado)}`,
  `  consentimiento:          ${cuenta((p) => p.fila.consentimiento)}`,
  `  en grupo de WhatsApp:    ${cuenta((p) => p.grupo)}`,
  `  parejas / adolesc. / niños: ${cuenta((p) => p.fila.tipo === "pareja")} / ${cuenta((p) => p.fila.tipo === "adolescente")} / ${cuenta((p) => p.fila.tipo === "nino")}`,
  `Tarifas 2026 / 2025:       ${pacientes.reduce((n, p) => n + p.tarifas.filter((t) => t.anio === 2026).length, 0)} / ${pacientes.reduce((n, p) => n + p.tarifas.filter((t) => t.anio === 2025).length, 0)}`,
  `Sesiones:                  ${totalSesiones}`,
  ...Object.entries(conteo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k.padEnd(24)} ${v}`),
  `Para revisar:              ${revisar.length} anotaciones`,
].join("\n");

console.log(`\nExcel: ${archivo}\n\n${resumen}\n`);

// Reporte local con el detalle (tiene nombres de pacientes: no se versiona).
const dirReportes = join(raiz, "reportes");
mkdirSync(dirReportes, { recursive: true });
const rutaReporte = join(dirReportes, "importacion-para-revisar.md");
writeFileSync(
  rutaReporte,
  `# Importación del Excel — para revisar con Marcela\n\n\`\`\`\n${resumen}\n\`\`\`\n\n` +
    `| Fila Excel | Paciente | Qué revisar |\n|---|---|---|\n` +
    revisar
      .sort((a, b) => a.fila - b.fila)
      .map((r) => `| ${r.fila} | ${r.nombre} | ${String(r.asunto).replace(/\|/g, "/")} |`)
      .join("\n") +
    "\n",
);
console.log(`Detalle para revisar: ${rutaReporte}\n`);

if (DRY) {
  console.log("Modo --dry-run: no se escribió nada en la base.");
  process.exit(0);
}

// ───────────────────────── Escritura ─────────────────────────
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(URL_SB, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ok = ({ data, error }, que) => {
  if (error) {
    console.error(`❌ ${que}: ${error.message}`);
    process.exit(1);
  }
  return data;
};
const enLotes = async (filas, tam, fn) => {
  for (let i = 0; i < filas.length; i += tam) await fn(filas.slice(i, i + tam));
};

const { count } = await sb.from("pacientes").select("id", { count: "exact", head: true });
if ((count ?? 0) > 0 && !FORZAR) {
  console.error(
    `❌ La base ya tiene ${count} pacientes. Volver a importar sobrescribe lo editado en el CRM.\n` +
      "   Si es lo que quieres: npm run importar -- --forzar",
  );
  process.exit(1);
}

const grupos = ok(await sb.from("grupos_whatsapp").select("id, nombre"), "leer grupos");
const planes = ok(await sb.from("planes_membresia").select("id, precio"), "leer planes");
const idGrupo = new Map(grupos.map((g) => [g.nombre, g.id]));
const idPlan = new Map(planes.map((p) => [Number(p.precio), p.id]));

const filas = pacientes.map((p) => ({
  ...p.fila,
  grupo_whatsapp_id: p.grupo ? (idGrupo.get(p.grupo) ?? null) : null,
  plan_membresia_id: p.precioPlan != null ? (idPlan.get(p.precioPlan) ?? null) : null,
}));

const idPorFila = new Map();
await enLotes(filas, 200, async (lote) => {
  const data = ok(
    await sb.from("pacientes").upsert(lote, { onConflict: "excel_fila" }).select("id, excel_fila"),
    "guardar pacientes",
  );
  for (const r of data) idPorFila.set(r.excel_fila, r.id);
});
console.log(`✓ ${idPorFila.size} pacientes`);

const tarifas = pacientes.flatMap((p) =>
  p.tarifas.map((t) => ({ paciente_id: idPorFila.get(p.fila.excel_fila), ...t })),
);
await enLotes(tarifas, 500, async (lote) =>
  ok(await sb.from("paciente_tarifas").upsert(lote, { onConflict: "paciente_id,anio" }), "guardar tarifas"),
);
console.log(`✓ ${tarifas.length} tarifas`);

const sesiones = pacientes.flatMap((p) =>
  p.sesiones.map((s) => ({ paciente_id: idPorFila.get(p.fila.excel_fila), origen: "excel", ...s })),
);
await enLotes(sesiones, 500, async (lote) =>
  ok(await sb.from("sesiones").upsert(lote, { onConflict: "paciente_id,numero" }), "guardar sesiones"),
);
console.log(`✓ ${sesiones.length} sesiones\n\n✅ Importación terminada.`);
