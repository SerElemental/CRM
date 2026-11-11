import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; bloqueado?: string }>;
}) {
  const { next, bloqueado } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Ser Elemental</h1>
          <p className="text-muted-foreground mt-1 text-sm">CRM del consultorio</p>
        </div>
        <div className="bg-card ring-foreground/[0.06] rounded-xl p-6 shadow-sm ring-1">
          {bloqueado && (
            <p className="bg-destructive/10 text-destructive mb-4 rounded-lg px-3 py-2 text-sm">
              Esta cuenta no tiene acceso al CRM.
            </p>
          )}
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
