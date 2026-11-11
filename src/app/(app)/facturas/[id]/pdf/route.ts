import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { facturaADatos } from "@/lib/facturas/esquema";
import { generarFacturaPDF } from "@/lib/facturas/factura-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * El PDF de una factura: `GET /facturas/<id>/pdf` lo muestra en el navegador y
 * `?descargar=1` lo baja. Se dibuja cada vez a partir de la «foto» guardada, así
 * que siempre sale igual.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile?.activo) return new Response("Sin acceso.", { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  const { data: f } = await supabase
    .from("facturas")
    .select("numero, fecha, cliente, emisor, items, notas, estado")
    .eq("id", id)
    .maybeSingle();
  if (!f) return new Response("La factura no existe.", { status: 404 });

  const datos = facturaADatos(f);
  const pdf = await generarFacturaPDF(datos);

  const nombre = `${f.numero} - ${datos.cliente.nombre}.pdf`;
  // En la cabecera solo caben caracteres ASCII; el nombre real (con tildes) va en filename*.
  const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
  const modo = request.nextUrl.searchParams.has("descargar") ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
