import { Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Menú lateral. Cada módulo nuevo del CRM se agrega aquí. */
export const NAV: NavItem[] = [{ href: "/pacientes", label: "Pacientes", icon: Users }];
