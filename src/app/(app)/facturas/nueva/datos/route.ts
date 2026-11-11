import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { pacienteParaFacturar } from "@/lib/facturas/paciente";
import { createClient } from "@/lib/supabase/server";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

/** Datos de un paciente para facturarle: `GET /facturas/nueva/datos?paciente=<id>`. */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile?.activo) return NextResponse.json({ error: "Sin acceso." }, { status: 401, headers: SIN_CACHE });

  const id = request.nextUrl.searchParams.get("paciente") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Paciente inválido." }, { status: 400, headers: SIN_CACHE });
  }
  const paciente = await pacienteParaFacturar(await createClient(), id);
  if (!paciente) return NextResponse.json({ error: "No existe." }, { status: 404, headers: SIN_CACHE });
  return NextResponse.json({ paciente }, { headers: SIN_CACHE });
}
