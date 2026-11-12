#!/usr/bin/env node
/**
 * Importa al CRM las historias clínicas que Marcela llevaba en Word.
 *
 * Uso:
 *   npm run importar:historias -- --dry-run     # solo analiza y muestra el resumen
 *   npm run importar:historias                  # carga las que falten
 *   npm run importar:historias -- "/ruta/a/la/carpeta"
 *
 * Los .docx tienen datos clínicos: viven FUERA del repositorio (por defecto, la
 * carpeta «historias clinicas activos» de arriba). El reporte queda en
 * `reportes/`, que tampoco se versiona, y no incluye texto clínico.
 *
 * Cada archivo se empareja con un paciente del CRM por el nombre. Si el nombre
 * solo se parece («Andrés Restrepo» ↔ «Andrés Felipe Restrepo») queda «por
 * confirmar»: se acepta poniéndolo en el mapa o con `--con-parciales`. Si no se
 * puede decidir, no se carga: se anota en el reporte y se resuelve a mano en
 * `datos/historias-mapa.json` ({ "Archivo.docx": "<id o nombre exacto del paciente>" }).
 * Con el valor "crear", el paciente se da de alta en el CRM con los datos del Word.
 *
 * Es repetible: un paciente que ya tiene historia se salta. Lo importado entra
 * «por revisar»: las notas quedan en borrador hasta que se confirme cada
 * historia en la pantalla de revisión del CRM.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { emparejarPaciente, interpretarHistoria, normalizarNombre } from "../src/lib/importacion/historia-word.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const CON_PARCIALES = args.includes("--con-parciales");
const carpeta = resolve(args.find((a) => !a.startsWith("--")) ?? join(raiz, "..", "historias clinicas activos"));
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

if (!existsSync(carpeta)) {
  console.error(`❌ No encuentro la carpeta:\n   ${carpeta}\n   Pásala como argumento: npm run importar:historias -- "/ruta/a/la/carpeta"`);
  process.exit(1);
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(URL_SB, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const archivoMapa = join(raiz, "datos", "historias-mapa.json");
const mapa = existsSync(archivoMapa) ? JSON.parse(readFileSync(archivoMapa, "utf8")) : {};

// ───────────────────────── Pacientes e historias que ya existen ─────────────────────────
const pacientes = [];
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await sb.from("pacientes").select("id, nombre_completo, estado").range(desde, desde + 999);
  if (error) { console.error(`❌ Leer pacientes: ${error.message}`); process.exit(1); }
  pacientes.push(...data);
  if (data.length < 1000) break;
}
const conHistoria = new Set();
{
  const { data, error } = await sb.from("historias").select("paciente_id");
  if (error && !DRY) { console.error(`❌ Leer historias: ${error.message}\n   ¿Falta aplicar la migración? npm run db:apply`); process.exit(1); }
  for (const h of data ?? []) conHistoria.add(h.paciente_id);
}

const TIPOS = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Lee un .docx: el texto interpretado y las imágenes del cuerpo (no el logo del encabezado). */
async function leer(archivo) {
  const bytes = readFileSync(join(carpeta, archivo));
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("no es un documento de Word válido");
  const rels = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const destino = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
    m[0].match(/\bId="([^"]+)"/)?.[1], m[0].match(/\bTarget="([^"]+)"/)?.[1],
  ]));
  const historia = interpretarHistoria(xml, hoy);
  const imagenes = [];
  for (const img of historia.imagenes) {
    const ruta = destino.get(img.rId);
    const tipo = ruta && TIPOS[extname(ruta).toLowerCase()];
    const entrada = tipo && zip.file(`word/${ruta.replace(/^\/?(word\/)?/, "")}`);
    if (entrada) imagenes.push({ genograma: img.genograma, tipo, ext: extname(ruta).toLowerCase(), datos: await entrada.async("nodebuffer") });
  }
  return { bytes, historia, imagenes };
}

function buscarPaciente(archivo, historia) {
  const fijado = mapa[archivo];
  if (fijado === "crear") return { paciente: null, crear: true };
  if (fijado) {
    const p = pacientes.find((x) => x.id === fijado || normalizarNombre(x.nombre_completo) === normalizarNombre(fijado));
    return p ? { paciente: p, como: "mapa" } : { paciente: null, motivo: `el mapa apunta a «${fijado}», que no existe en el CRM` };
  }
  for (const nombre of [archivo, historia.nombre].filter(Boolean)) {
    const { paciente, candidatos } = emparejarPaciente(nombre, pacientes);
    if (paciente) {
      const exacto = normalizarNombre(paciente.nombre_completo) === normalizarNombre(nombre);
      return { paciente, como: exacto ? "exacto" : "parcial" };
    }
    if (candidatos.length > 1) {
      return { paciente: null, motivo: `hay ${candidatos.length} pacientes posibles: ${candidatos.map((c) => `${c.nombre_completo} (${c.estado})`).join("; ")}` };
    }
  }
  return { paciente: null, motivo: "ningún paciente del CRM tiene ese nombre" };
}

async function cargar(archivo, paciente, como, { bytes, historia: h, imagenes }) {
  const avisos = [...h.avisos];
  if (como === "parcial") {
    avisos.unshift(`El archivo es «${archivo.replace(/\.docx$/i, "").trim()}» y se enlazó con «${paciente.nombre_completo}». Comprueba que sea la misma persona.`);
  }
  const fallo = (paso, error) => new Error(`${paso}: ${error.message}`);

  const { error: e1 } = await sb.from("historias").insert({
    paciente_id: paciente.id, origen: "word", archivo_origen: archivo, texto_origen: h.origen, avisos,
    ...h.identificacion, profesional: h.identificacion.profesional ?? "Marcela Salazar", ...h.secciones,
  });
  if (e1) throw fallo("crear la historia", e1);

  try {
    if (h.objetivos.length > 0) {
      const { error } = await sb.from("historia_objetivos").insert(
        h.objetivos.map((nombre, i) => ({ paciente_id: paciente.id, nombre, orden: i + 1 })),
      );
      if (error) throw fallo("cargar el plan de trabajo", error);
    }
    if (h.notas.length > 0) {
      const { error } = await sb.from("historia_notas").insert(h.notas.map((n) => ({
        paciente_id: paciente.id, numero: n.numero, fecha: n.fecha, fecha_texto: n.fecha_texto,
        campos: n.campos, origen: "word", encabezado_origen: n.encabezado, estado: "borrador",
      })));
      if (error) throw fallo("cargar las sesiones", error);
    }
    const adjuntos = [{ nombre: "Archivo original de Word", tipo: DOCX, ext: ".docx", datos: bytes }];
    let genogramas = 0, otras = 0;
    for (const img of imagenes) {
      const n = img.genograma ? ++genogramas : ++otras;
      adjuntos.push({ ...img, nombre: `${img.genograma ? "Genograma familiar" : "Imagen del archivo original"}${n > 1 ? ` ${n}` : ""}` });
    }
    for (const a of adjuntos) {
      const ruta = `${paciente.id}/${randomUUID()}${a.ext}`;
      const { error: eSubir } = await sb.storage.from("historias").upload(ruta, a.datos, { contentType: a.tipo });
      if (eSubir) throw fallo(`subir «${a.nombre}»`, eSubir);
      const { error } = await sb.from("historia_adjuntos").insert({
        paciente_id: paciente.id, nombre: a.nombre, ruta, tipo: a.tipo, tamano: a.datos.length,
      });
      if (error) throw fallo(`registrar «${a.nombre}»`, error);
    }
  } catch (e) {
    // Todo o nada por paciente: si algo falla, se deshace lo que se alcanzó a crear.
    const { data: subidos } = await sb.from("historia_adjuntos").select("ruta").eq("paciente_id", paciente.id);
    if (subidos?.length) await sb.storage.from("historias").remove(subidos.map((s) => s.ruta));
    for (const t of ["historia_adjuntos", "historia_notas", "historia_objetivos", "historia_cambios"]) {
      await sb.from(t).delete().eq("paciente_id", paciente.id);
    }
    await sb.from("historias").delete().eq("paciente_id", paciente.id);
    throw e;
  }
  return avisos;
}

// ───────────────────────── Recorrido ─────────────────────────
const archivos = readdirSync(carpeta).filter((f) => /\.docx$/i.test(f) && !f.startsWith("~$")).sort((a, b) => a.localeCompare(b, "es"));
const filas = [];
const usados = new Map();

for (const archivo of archivos) {
  const fila = { archivo, estado: "", detalle: "", avisos: [] };
  filas.push(fila);
  try {
    const leido = await leer(archivo);
    const h = leido.historia;
    let { paciente, como, motivo, crear } = buscarPaciente(archivo, h);
    if (crear) {
      // El mapa pide crear al paciente: todavía no está en el CRM.
      const nombre = archivo.replace(/\.docx$/i, "").replace(/\s+/g, " ").trim();
      if (DRY) {
        paciente = { id: `nuevo:${nombre}`, nombre_completo: nombre, estado: "activo" };
      } else {
        const { data, error } = await sb.from("pacientes").insert({
          nombre_completo: nombre, telefono: h.telefono, email: h.email?.toLowerCase() ?? null,
          estado: "activo", fecha_inicio: h.identificacion.fecha_consulta,
        }).select("id, nombre_completo, estado").single();
        if (error) throw new Error(`crear el paciente: ${error.message}`);
        paciente = data;
      }
      como = "paciente nuevo";
    }
    const llenas = ["motivo_consulta", "antecedentes", "nucleo_familiar", "relaciones_sociales", "relaciones_profesionales", "concepto_general"]
      .filter((c) => h.secciones[c]).length;
    fila.detalle = `${h.notas.length} sesiones · ${h.objetivos.length} objetivos · ${llenas}/6 secciones · ${leido.imagenes.length} imágenes · ${h.avisos.length} avisos`;
    fila.avisos = h.avisos;
    if (!paciente) { fila.estado = "SIN PACIENTE"; fila.detalle += ` — ${motivo}`; continue; }
    if (usados.has(paciente.id)) {
      fila.estado = "REPETIDO"; fila.detalle += ` — coincide con el mismo paciente que «${usados.get(paciente.id)}»`; continue;
    }
    usados.set(paciente.id, archivo);
    fila.paciente = `${paciente.nombre_completo}${como === "exacto" ? "" : ` (${como})`}`;
    if (conHistoria.has(paciente.id)) { fila.estado = "YA TENÍA"; continue; }
    // Un nombre parecido no basta para una historia clínica: hay que confirmarlo en el mapa.
    if (como === "parcial" && !CON_PARCIALES) { fila.estado = "POR CONFIRMAR"; continue; }
    if (DRY) { fila.estado = "SE CARGARÍA"; continue; }
    fila.avisos = await cargar(archivo, paciente, como, leido);
    fila.estado = "CARGADA";
  } catch (e) {
    fila.estado = "ERROR";
    fila.detalle = e.message;
  }
}

// ───────────────────────── Resumen y reporte ─────────────────────────
const cuenta = (e) => filas.filter((f) => f.estado === e).length;
console.log(`\n${DRY ? "ENSAYO (no se escribió nada)" : "IMPORTACIÓN"} · ${archivos.length} archivos en ${carpeta}\n`);
for (const f of filas) {
  console.log(`  ${f.estado.padEnd(12)} ${f.archivo}${f.paciente ? `  →  ${f.paciente}` : ""}\n               ${f.detalle}`);
}
console.log(
  `\n  ${DRY ? `Se cargarían: ${cuenta("SE CARGARÍA")}` : `Cargadas: ${cuenta("CARGADA")}`} · ya tenían historia: ${cuenta("YA TENÍA")}` +
  ` · por confirmar: ${cuenta("POR CONFIRMAR")} · sin paciente: ${cuenta("SIN PACIENTE")} · repetidos: ${cuenta("REPETIDO")} · con error: ${cuenta("ERROR")}\n`,
);

const dirReportes = join(raiz, "reportes");
mkdirSync(dirReportes, { recursive: true });
const reporte = join(dirReportes, `importacion-historias${DRY ? "-ensayo" : ""}.md`);
writeFileSync(reporte, [
  `# Importación de historias clínicas${DRY ? " (ensayo)" : ""} · ${hoy}`, "",
  ...filas.flatMap((f) => [
    `## ${f.archivo}`, "", `- Resultado: **${f.estado}**${f.paciente ? ` → ${f.paciente}` : ""}`, `- ${f.detalle}`,
    ...f.avisos.map((a) => `- Aviso: ${a}`), "",
  ]),
].join("\n"));
console.log(`  Reporte: ${reporte}\n`);
if (cuenta("ERROR") > 0) process.exit(1);
