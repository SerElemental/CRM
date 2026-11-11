import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { facturaNuevaSchema, itemsParaGuardar, leerEmisor } from "@/lib/facturas/esquema";
import { generarFacturaPDF } from "@/lib/facturas/factura-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * Vista previa de una factura que todavía no se ha emitido: recibe lo mismo que
 * el formulario y devuelve el PDF con el sello «Vista previa» y sin consecutivo.
 * No guarda nada.
 */
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile?.activo) return new Response("Sin acceso.", { status: 401 });

  let crudo: unknown;
  try {
    crudo = JSON.parse(String((await request.formData()).get("datos") ?? ""));
  } catch {
    return new Response("Datos inválidos.", { status: 400 });
  }
  const r = facturaNuevaSchema.safeParse(crudo);
  if (!r.success) {
    return new Response(`No se puede generar la vista previa: ${r.error.issues[0]?.message ?? "revisa los datos"}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = await createClient();
  const { data: fila } = await supabase.from("emisores").select("datos").eq("clave", r.data.emisor).maybeSingle();
  if (!fila) return new Response("La empresa no existe.", { status: 400 });
  const emisor = leerEmisor(fila.datos);

  const pdf = await generarFacturaPDF({
    numero: `${emisor.prefijo}-${r.data.fecha.slice(0, 4)}-····`,
    fecha: r.data.fecha,
    emisor,
    cliente: r.data.cliente,
    items: itemsParaGuardar(r.data.items),
    notas: r.data.notas,
    sello: "vista_previa",
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="vista-previa.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
