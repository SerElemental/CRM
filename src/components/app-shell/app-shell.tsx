"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cerrarSesion } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppShell({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r transition-transform duration-200 md:static md:translate-x-0",
          abierto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/pacientes" className="leading-tight" onClick={() => setAbierto(false)}>
            <span className="block text-base font-semibold tracking-tight">Ser Elemental</span>
            <span className="text-sidebar-foreground/60 block text-xs">CRM del consultorio</span>
          </Link>
          <button
            type="button"
            className="text-sidebar-foreground/70 md:hidden"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const activo = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activo
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className={cn("size-4", activo && "text-sidebar-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-sidebar-border flex items-center gap-3 border-t p-4">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {iniciales(nombre) || "SE"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{nombre}</span>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground rounded-md p-1.5"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      {abierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setAbierto(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card border-border flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">Ser Elemental</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
