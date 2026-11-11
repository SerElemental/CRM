"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { iniciales } from "@/components/ui/iniciales";
import { NAV } from "@/lib/nav";
import { cerrarSesion } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const LOGO = { src: "/marca/logo-ser-elemental-transparente.png", width: 2160, height: 383 };

/**
 * Marco de la app. En escritorio, menú lateral rosa con el logo; en el móvil,
 * barra superior con el logo y navegación fija abajo (sin menú escondido).
 */
export function AppShell({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const esActivo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-58 shrink-0 flex-col gap-8 px-4 pt-7 pb-5 md:flex">
        <Link href="/inicio" className="block px-2.5">
          <Image src={LOGO.src} alt="Ser Elemental" width={LOGO.width} height={LOGO.height} priority className="h-auto w-[10.75rem]" />
        </Link>

        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const activo = esActivo(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-[0.9rem] transition-colors",
                  activo
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "hover:bg-sidebar-accent/45 font-medium",
                )}
              >
                <item.icon className="size-[1.125rem]" strokeWidth={activo ? 2 : 1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-sidebar-border mt-auto flex items-center gap-2.5 border-t px-1.5 pt-4">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-[2.125rem] shrink-0 items-center justify-center rounded-full text-[0.78rem] font-semibold">
            {iniciales(nombre) || "SE"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{nombre}</span>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="hover:bg-sidebar-accent/45 flex size-9 items-center justify-center rounded-lg"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="size-[1.05rem]" />
            </button>
          </form>
        </div>
      </aside>

      <header className="bg-sidebar text-sidebar-foreground sticky top-0 z-30 flex h-15 items-center justify-between pr-2 pl-4 md:hidden">
        <Link href="/inicio">
          <Image src={LOGO.src} alt="Ser Elemental" width={LOGO.width} height={LOGO.height} priority className="h-7 w-auto" />
        </Link>
        <form action={cerrarSesion}>
          <button type="submit" className="flex size-11 items-center justify-center" aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut className="size-5" />
          </button>
        </form>
      </header>

      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-[75rem] px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-14">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="bg-card border-input fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map((item) => {
          const activo = esActivo(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                activo ? "text-foreground font-semibold shadow-[inset_0_2px_0_var(--foreground)]" : "text-secondary-foreground font-medium",
              )}
            >
              <item.icon className="size-5" strokeWidth={activo ? 2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
