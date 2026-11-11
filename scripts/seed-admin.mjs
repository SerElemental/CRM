#!/usr/bin/env node
/**
 * Crea (o actualiza) una cuenta con acceso al CRM.
 *
 * Uso:
 *   npm run seed:admin -- <correo> "<Nombre>"
 *
 * La contraseña se pide por teclado y NO se muestra al escribirla (se pide dos
 * veces para evitar errores). Tampoco queda en el historial de la terminal.
 * Usa la service key: crea el usuario en Supabase Auth con el correo confirmado
 * y le crea el perfil activo. Sin perfil activo nadie entra al CRM.
 */
import { createClient } from "@supabase/supabase-js";

const [email, nombre] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !nombre) {
  console.error('Uso: npm run seed:admin -- <correo> "<Nombre>"');
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || /@(ejemplo|example)\./i.test(email)) {
  console.error(`❌ «${email}» no es un correo real. Escribe el tuyo en lugar del de ejemplo.`);
  process.exit(1);
}
if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

/** Lee una línea del teclado sin mostrar lo que se escribe. */
function pedirSecreto(pregunta) {
  return new Promise((resolver) => {
    const entrada = process.stdin;
    if (!entrada.isTTY) {
      console.error("❌ Ejecuta este comando en una terminal interactiva.");
      process.exit(1);
    }
    process.stdout.write(pregunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    let texto = "";
    const alTeclear = (trozo) => {
      for (const c of trozo) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", alTeclear);
          process.stdout.write("\n");
          return resolver(texto);
        }
        if (c === "\u0003") {
          entrada.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (c === "\u007f" || c === "\b") texto = texto.slice(0, -1);
        else if (c >= " ") texto += c;
      }
    };
    entrada.on("data", alTeclear);
  });
}

const password = await pedirSecreto(`Contraseña para ${email} (mínimo 10 caracteres, no se verá al escribir): `);
if (password.length < 10) {
  console.error("❌ La contraseña debe tener al menos 10 caracteres.");
  process.exit(1);
}
if ((await pedirSecreto("Repítela para confirmar: ")) !== password) {
  console.error("❌ Las dos contraseñas no coinciden. Vuelve a ejecutar el comando.");
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
