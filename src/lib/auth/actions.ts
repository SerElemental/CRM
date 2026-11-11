"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

const esquema = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

/** Solo se aceptan destinos internos, para no redirigir a otro sitio tras el login. */
function destinoSeguro(next: FormDataEntryValue | null) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/pacientes";
}

export async function iniciarSesion(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const datos = esquema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(datos.data);
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect(destinoSeguro(formData.get("next")));
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
