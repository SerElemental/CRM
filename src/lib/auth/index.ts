import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  nombre: string | null;
  activo: boolean;
  email: string | null;
};

/** Perfil del usuario actual, o null si no hay sesión o no tiene perfil. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nombre, activo")
    .eq("id", user.id)
    .maybeSingle();

  return data ? { ...data, email: user.email ?? null } : null;
}

/**
 * Exige sesión + perfil activo. Lo llama `(app)/layout.tsx` en cada pantalla y
 * cada Server Action antes de escribir. Una cuenta sin perfil (p. ej. alguien
 * que se registró por su cuenta) o dada de baja no entra: se le cierra la sesión.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?bloqueado=1");
  }
  return profile;
}
