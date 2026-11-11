#!/usr/bin/env node
/**
 * Crea (o actualiza) una cuenta con acceso al CRM.
 *
 * Uso:
 *   npm run seed:admin -- <correo> "<Nombre>"
 *
 * La contraseña se pide por teclado (no queda en el historial de la terminal).
 * Usa la service key: crea el usuario en Supabase Auth con el correo confirmado
 * y le crea el perfil activo. Sin perfil activo nadie entra al CRM.
 */
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const [email, nombre] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !nombre) {
  console.error('Uso: npm run seed:admin -- <correo> "<Nombre>"');
  process.exit(1);
}
if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question(`Contraseña para ${email} (mínimo 10 caracteres): `)).trim();
rl.close();
if (password.length < 10) {
  console.error("❌ La contraseña debe tener al menos 10 caracteres.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let id;
const creado = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (creado.error) {
  if (!/already|registered|exists/i.test(creado.error.message)) {
    console.error("❌ No se pudo crear el usuario:", creado.error.message);
    process.exit(1);
  }
  // Ya existía: se busca y se le actualiza la contraseña.
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existente = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (error || !existente) {
    console.error("❌ El usuario ya existe pero no se pudo encontrar.");
    process.exit(1);
  }
  id = existente.id;
  await sb.auth.admin.updateUserById(id, { password, email_confirm: true });
} else {
  id = creado.data.user.id;
}

const { error } = await sb.from("profiles").upsert({ id, nombre, activo: true });
if (error) {
  console.error("❌ No se pudo crear el perfil:", error.message);
  process.exit(1);
}
console.log(`✅ ${nombre} (${email}) ya puede entrar al CRM.`);
