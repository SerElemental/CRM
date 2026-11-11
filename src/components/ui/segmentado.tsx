import { cn } from "@/lib/utils";

type Opcion = { value: string; label: string };

/**
 * Dos a cuatro opciones que se eligen con un toque, en vez de un desplegable.
 * Por dentro son botones de radio, así que viaja en el formulario con su `name`.
 * Con `value` + `onChange` es controlado; con `defaultValue`, no.
 */
export function Segmentado({
  name, opciones, defaultValue, value, onChange, className, ...aria
}: {
  name: string;
  opciones: Opcion[];
  defaultValue?: string;
  value?: string;
  onChange?: (valor: string) => void;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <div
      role="radiogroup"
      {...aria}
      className={cn("bg-secondary grid gap-[3px] rounded-lg p-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => (
        <label
          key={o.value}
          className="text-secondary-foreground has-checked:border-input has-checked:bg-card has-checked:text-foreground has-focus-visible:ring-ring/50 flex min-h-9 cursor-pointer items-center justify-center rounded-[5px] border border-transparent px-2 py-1 text-center text-[0.84rem] leading-tight font-medium transition-colors has-focus-visible:ring-3"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            className="sr-only"
            {...(value !== undefined
              ? { checked: value === o.value, onChange: () => onChange?.(o.value) }
              : { defaultChecked: defaultValue === o.value })}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
