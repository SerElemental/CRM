import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { normalizarBusqueda } from "@/lib/pacientes-filtros";
import { MAX_SUGERENCIAS, MIN_LETRAS, ordenarSugerencias } from "@/lib/sugerencias";
import { createClient } from "@/lib/supabase/server";

const COLUMNAS = "id, nombre_completo, telefono, email, estado, pais";
const SIN_CACHE = { "Cache-Control": "private, no-store" };

/**
 * Sugerencias del buscador: `GET /pacientes/sugerencias?q=an`.
 * Busca en TODOS los pacientes (no depende de los filtros del listado).
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile?.activo) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 401, headers: SIN_CACHE });
  }

  const q = normalizarBusqueda(request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  if (q.length < MIN_LETRAS) {
    return NextResponse.json({ sugerencias: [], total: 0 }, { headers: SIN_CACHE });
  }
  const patron = q.replace(/[\\%_]/g, "\\$&");

  const supabase = await createClient();
  // Dos consultas: los nombres que EMPIEZAN por lo escrito (los mejores) y, aparte,
  // los que lo contienen en cualquier parte. Con una sola, ordenada por nombre, una
  // búsqueda como «an» se llenaría de «Adriana…» y dejaría por fuera a «Ana…».
  const [empiezan, contienen] = await Promise.all([
    supabase.from("pacientes").select(COLUMNAS).ilike("busqueda", `${patron}%`)
      .order("nombre_completo").limit(MAX_SUGERENCIAS),
    supabase.from("pacientes").select(COLUMNAS, { count: "exact" }).ilike("busqueda", `%${patron}%`)
      .order("nombre_completo").limit(40),
  ]);
  if (empiezan.error || contienen.error) {
    return NextResponse.json({ error: "No se pudo buscar." }, { status: 500, headers: SIN_CACHE });
  }

  return NextResponse.json(
    {
      sugerencias: ordenarSugerencias([...empiezan.data, ...contienen.data], q),
      total: contienen.count ?? 0,
    },
    { headers: SIN_CACHE },
  );
}
