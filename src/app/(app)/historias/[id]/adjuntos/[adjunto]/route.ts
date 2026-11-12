import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Un adjunto de la historia: `GET /historias/<paciente>/adjuntos/<id>`. Los
 * archivos son privados; la app comprueba la sesión y redirige a un enlace de
 * Supabase que caduca en un minuto.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; adjunto: string }> }) {
  const profile = await getProfile();
  if (!profile?.activo) return new Response("Sin acceso.", { status: 401 });

  const { id, adjunto } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("historia_adjuntos").select("ruta").eq("id", adjunto).eq("paciente_id", id).maybeSingle();
  if (!a) return new Response("El archivo no existe.", { status: 404 });

  const { data: firmado } = await supabase.storage.from("historias").createSignedUrl(a.ruta, 60);
  if (!firmado?.signedUrl) return new Response("No se pudo abrir el archivo.", { status: 502 });

  return new Response(null, {
    status: 307,
    headers: { Location: firmado.signedUrl, "Cache-Control": "private, no-store" },
  });
}
