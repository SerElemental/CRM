import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const RUTAS_PUBLICAS = ["/login", "/auth"];

function esPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refresca la sesión de Supabase en cada petición, propaga las cookies y manda
 * a /login cuando se pide una ruta protegida sin sesión.
 */
export async function updateSession(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([k, v]) => respuesta.headers.set(k, v));
        },
      },
    },
  );

  // IMPORTANTE: no ejecutar lógica entre createServerClient y getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !esPublica(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return respuesta;
}
