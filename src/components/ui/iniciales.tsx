import { cn } from "@/lib/utils";

/** «Ana Lucía Restrepo» → «AL». */
export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Círculo con las iniciales: ayuda a ubicar a la persona en listas largas. */
export function Iniciales({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-accent text-link flex size-[2.125rem] shrink-0 items-center justify-center rounded-full text-[0.78rem] font-semibold",
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}
