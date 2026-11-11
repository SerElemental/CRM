#!/usr/bin/env node
/**
 * Carga (o actualiza) en la base los datos de las empresas que facturan.
 *
 *   npm run cargar:emisores
 *
 * Lee `datos/emisores.json`, que NO se versiona porque trae cuentas bancarias.
 * Cada empresa puede traer `consecutivos` para continuar una numeración que ya
 * venía de antes: { "2026": 1 } significa «el último número usado en 2026 fue
 * el 1», así la siguiente factura será la 0002. Un consecutivo nunca se baja.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { emisorSchema } from "../src/lib/facturas/esquema.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const ruta = join(dirname(fileURLToPath(import.meta.url)), "..", "datos", "emisores.json");
const crudo = JSON.parse(readFileSync(ruta, "utf8"));
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

for (const [i, entrada] of crudo.entries()) {
  const { consecutivos = {}, ...resto } = entrada;
  const datos = emisorSchema.parse(resto);

  const { error } = await sb.from("emisores").upsert({ clave: datos.clave, datos, orden: i, activo: true });
  if (error) {
    console.error(`❌ ${datos.clave}: ${error.message}`);
    process.exit(1);
  }

  for (const [anio, ultimo] of Object.entries(consecutivos)) {
    const { data: actual } = await sb
      .from("factura_consecutivos")
      .select("ultimo")
      .eq("emisor_clave", datos.clave)
      .eq("anio", Number(anio))
      .maybeSingle();
    if ((actual?.ultimo ?? 0) < ultimo) {
      const r = await sb
        .from("factura_consecutivos")
        .upsert({ emisor_clave: datos.clave, anio: Number(anio), ultimo });
      if (r.error) {
        console.error(`❌ consecutivo ${datos.clave} ${anio}: ${r.error.message}`);
        process.exit(1);
      }
    }
  }
  console.log(`✓ ${datos.clave} · ${datos.razonSocial} · ${datos.nombreDocumento} (${datos.prefijo}, ${datos.moneda})`);
}
console.log("\n✅ Empresas cargadas.");
