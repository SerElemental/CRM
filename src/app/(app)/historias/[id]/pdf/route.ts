import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import type { HistoriaNota } from "@/lib/database.types";
import { fechaLarga } from "@/lib/facturas/tipos";
import { formatearFecha, hoyBogota } from "@/lib/fecha";
import {
  CAMPOS_SECCION, IDENTIFICACION, formatearFechaHora, numeroHistoria, rangosDeSesiones, textoEdad,
} from "@/lib/historias";
import { generarHistoriaPDF, type DatosHistoriaPDF, type NotaPDF } from "@/lib/historias/historia-pdf";
import { MODALIDAD_LABEL } from "@/lib/pacientes";
import { createClient } from "@/lib/supabase/server";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El PDF de la historia: `GET /historias/<paciente>/pdf`.
 *   alcance=todo|valoracion|rango   (por defecto, todo)
 *   desde, hasta                    (con alcance=rango)
 *   adendas=1 · borradores=1 · imagenes=1 · descargar=1
 * Sale sin clave. Cada exportación queda en el historial de la historia.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile?.activo) return new Response("Sin acceso.", { status: 401 });

  const { id } = await params;
  const q = request.nextUrl.searchParams;
  const alcance = ["valoracion", "rango"].includes(q.get("alcance") ?? "") ? (q.get("alcance") as "valoracion" | "rango") : "todo";
  const desde = q.get("desde") ?? "";
  const hasta = q.get("hasta") ?? "";
  if (alcance === "rango" && (!FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta)) {
    return new Response("El rango de fechas no es válido.", { status: 400 });
  }

  const supabase = await createClient();
  const [{ data: p }, { data: h }] = await Promise.all([
    supabase.from("pacientes").select("nombre_completo, documento, telefono, email").eq("id", id).maybeSingle(),
    supabase.from("historias").select("*").eq("paciente_id", id).maybeSingle(),
  ]);
  if (!p || !h) return new Response("La historia no existe.", { status: 404 });

  const [{ data: notasCrudas }, { data: objetivos }, { data: adjuntos }] = await Promise.all([
    supabase.from("historia_notas").select("*").eq("paciente_id", id).order("numero"),
    supabase.from("historia_objetivos").select("*").eq("paciente_id", id).order("orden").order("created_at"),
    q.has("imagenes") && alcance !== "rango"
      ? supabase.from("historia_adjuntos").select("nombre, ruta, tipo").eq("paciente_id", id)
          .in("tipo", ["image/png", "image/jpeg"]).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const todas = (notasCrudas ?? []) as HistoriaNota[];
  const nombreObjetivo = new Map((objetivos ?? []).map((o) => [o.id, o.nombre]));

  // ── Notas que entran ──
  let notas: NotaPDF[] | null = null;
  if (alcance !== "valoracion") {
    const elegidas = todas.filter((n) =>
      (n.estado === "firmada" || q.has("borradores")) &&
      (alcance !== "rango" || (n.fecha != null && n.fecha >= desde && n.fecha <= hasta)),
    );
    const firmadas = elegidas.filter((n) => n.estado === "firmada").map((n) => n.id);
    const { data: adendas } = q.has("adendas") && firmadas.length > 0
      ? await supabase.from("historia_adendas").select("*").in("nota_id", firmadas).order("created_at")
      : { data: [] };
    notas = elegidas.map((n) => ({
      numero: n.numero,
      fecha: n.fecha ? formatearFecha(n.fecha) : (n.fecha_texto ?? "Sin fecha"),
      detalle: [n.duracion_min && `${n.duracion_min} min`, n.modalidad && MODALIDAD_LABEL[n.modalidad]].filter(Boolean).join(" · "),
      formato: n.formato,
      campos: n.campos ?? {},
      objetivos: n.objetivos.map((o) => nombreObjetivo.get(o)).filter((x): x is string => Boolean(x)),
      firma: n.estado === "firmada" ? `Firmada por ${n.firmada_nombre ?? "el equipo"} · ${formatearFechaHora(n.firmada_el)}` : null,
      importada: n.origen === "word",
      adendas: (adendas ?? []).filter((a) => a.nota_id === n.id).map((a) => ({
        encabezado: `Adenda · ${formatearFechaHora(a.created_at)} · ${a.autor_nombre ?? "Equipo"}`,
        texto: a.texto,
      })),
    }));
  }

  // ── Valoración, plan e imágenes ──
  let valoracion: DatosHistoriaPDF["valoracion"] = null;
  if (alcance !== "rango") {
    const imagenes: NonNullable<DatosHistoriaPDF["valoracion"]>["imagenes"] = [];
    for (const a of adjuntos ?? []) {
      const { data: archivo } = await supabase.storage.from("historias").download(a.ruta);
      if (!archivo) continue;
      imagenes.push({
        nombre: a.nombre, data: Buffer.from(await archivo.arrayBuffer()), format: a.tipo === "image/png" ? "png" : "jpg",
      });
    }
    valoracion = {
      secciones: Object.fromEntries(CAMPOS_SECCION.map((c) => [c, h[c]])),
      objetivos: (objetivos ?? []).map((o) => ({
        nombre: o.nombre, estado: o.estado,
        sesiones: rangosDeSesiones(todas.filter((n) => n.objetivos.includes(o.id)).map((n) => n.numero)),
      })),
      imagenes,
    };
  }

  const identificacion = [
    { etiqueta: "Nombre", valor: p.nombre_completo },
    { etiqueta: "Documento", valor: p.documento },
    { etiqueta: "Edad", valor: textoEdad(h) },
    { etiqueta: "Teléfono", valor: p.telefono },
    { etiqueta: "Correo", valor: p.email },
    ...IDENTIFICACION.map((c) => {
      const valor = h[c.campo] as string | null;
      const texto = c.campo === "fecha_consulta" && !valor ? h.fecha_consulta_texto : c.tipo === "date" && valor ? formatearFecha(valor) : valor;
      return { etiqueta: c.label.replace("Profesional que atiende", "Profesional"), valor: texto };
    }),
  ].map((d) => ({ etiqueta: d.etiqueta, valor: d.valor?.trim() || "—" }));

  const numero = numeroHistoria(h.numero);
  const pdf = await generarHistoriaPDF({
    numero,
    nombre: p.nombre_completo,
    profesional: h.profesional,
    exportada: fechaLarga(hoyBogota(), "es"),
    identificacion,
    valoracion,
    notas,
    rango: alcance === "rango" ? `Sesiones del ${formatearFecha(desde)} al ${formatearFecha(hasta)}` : undefined,
  });

  // Constancia en el historial. Si falla, el PDF sale igual: lo que importa es no dejar a la persona sin su documento.
  await supabase.rpc("registrar_exportacion", {
    p_paciente: id,
    p_detalle: alcance === "todo"
      ? "la historia completa"
      : alcance === "valoracion" ? "la valoración inicial" : `las sesiones del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`,
  });

  const nombre = `${numero} ${p.nombre_completo}.pdf`;
  const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
  const modo = q.has("descargar") ? "attachment" : "inline";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
