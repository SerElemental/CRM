import { ClipboardList, House, ReceiptText, Users, type LucideIcon } from "lucide-react";

/** `corto` es el nombre que cabe en la barra inferior del móvil. */
export type NavItem = { href: string; label: string; corto?: string; icon: LucideIcon };

/** Menú lateral. Cada módulo nuevo del CRM se agrega aquí. */
export const NAV: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/historias", label: "Historias clínicas", corto: "Historias", icon: ClipboardList },
  { href: "/facturas", label: "Facturas", icon: ReceiptText },
];
