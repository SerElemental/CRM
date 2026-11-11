import type { ReactNode } from "react";

import type { Tono } from "@/lib/tono";
import { cn } from "@/lib/utils";

const PUNTO: Record<Tono, string> = {
  success: "border-success bg-success",
  warning: "border-warning bg-warning",
  neutral: "border-neutral bg-neutral",
  danger: "border-destructive bg-destructive",
  outline: "border-muted-foreground bg-card",
};

/** Estado como punto de color + palabra: el color nunca va solo. */
export function Estado({
  tono, children, className,
}: {
  tono: Tono;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full border-2", PUNTO[tono])} />
      {children}
    </span>
  );
}
