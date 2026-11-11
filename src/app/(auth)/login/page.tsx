import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

/** El eneagrama del logo, dibujado en línea: círculo punteado, triángulo y hexada. */
function Eneagrama({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className={className}>
      <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 7" />
      <polygon points="200,20 355.9,290 44.1,290" fill="#fff6d6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon
        points="315.7,62.1 261.6,369.1 377.3,168.7 84.3,62.1 138.4,369.1 22.7,168.7"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; bloqueado?: string }>;
}) {
  const { next, bloqueado } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="bg-brand text-brand-foreground flex flex-col justify-between gap-8 px-6 py-8 md:w-1/2 md:px-14 md:py-12">
        <Image
          src="/marca/logo-ser-elemental-transparente.png" alt="Ser Elemental" width={2160} height={383} priority
          className="h-auto w-48 md:w-64"
        />
        <Eneagrama className="hidden w-full max-w-[23rem] self-center md:block" />
        <div className="max-w-md space-y-1.5">
          <p className="text-secondary-foreground text-xs font-medium tracking-[0.07em] uppercase">CRM del consultorio</p>
          <p className="text-lg leading-snug font-medium tracking-[-0.015em] md:text-[1.375rem]">
            Pacientes, sesiones y facturación en un solo lugar.
          </p>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-5 py-10 md:px-8">
        <div className="w-full max-w-[22.5rem] space-y-7">
          <div className="space-y-1.5">
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">Iniciar sesión</h1>
            <p className="text-muted-foreground text-sm">Entra con tu correo del consultorio.</p>
          </div>
          {bloqueado && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
              Esta cuenta no tiene acceso al CRM.
            </p>
          )}
          <LoginForm next={next} />
          <p className="text-muted-foreground border-border border-t pt-5 text-[0.8125rem]">
            Acceso solo para el equipo de Ser Elemental. Si no puedes entrar, pídele a quien administra el CRM que
            revise tu cuenta.
          </p>
        </div>
      </main>
    </div>
  );
}
