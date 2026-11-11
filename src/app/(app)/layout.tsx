import { AppShell } from "@/components/app-shell/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <AppShell nombre={profile.nombre ?? profile.email ?? "Usuario"}>{children}</AppShell>;
}
