import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { hoyBogota } from "@/lib/fecha";
import { leerEmisor } from "@/lib/facturas/esquema";
import { pacienteParaFacturar } from "@/lib/facturas/paciente";
import { createClient } from "@/lib/supabase/server";
import { FacturaForm } from "./factura-form";

export const metadata: Metadata = { title: "Nueva factura" };

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string }>;
}) {
  const { paciente: pacienteId } = await searchParams;
  const supabase = await createClient();

  const [{ data: filas }, paciente] = await Promise.all([
    supabase.from("emisores").select("datos").eq("activo", true).order("orden"),
    pacienteId && /^[0-9a-f-]{36}$/i.test(pacienteId) ? pacienteParaFacturar(supabase, pacienteId) : null,
  ]);
  const emisores = (filas ?? []).map((f) => leerEmisor(f.datos));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={paciente ? `/pacientes/${paciente.id}` : "/facturas"}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> {paciente ? paciente.nombre : "Facturas"}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nueva factura</h1>

      {emisores.length === 0 ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          Todavía no están cargados los datos de las empresas que facturan. Hay que ejecutar
          «npm run cargar:emisores».
        </p>
      ) : (
        <FacturaForm emisores={emisores} hoy={hoyBogota()} pacienteInicial={paciente} />
      )}
    </div>
  );
}
