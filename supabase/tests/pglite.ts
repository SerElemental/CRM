import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const migDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Lo mínimo de Supabase que las migraciones dan por hecho (roles, auth, extensions). */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  grant usage on schema extensions to public;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon, service_role;
`;

/** Postgres en memoria con todas las migraciones del repo aplicadas en orden. */
export async function crearBase() {
  const db = new PGlite({ extensions: { unaccent } });
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(migDir, f), "utf8"));
    } catch (e) {
      throw new Error(`Migración ${f}: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Ejecuta `fn` como un usuario autenticado (rol + auth.uid()), igual que la Data API. */
export async function como<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
