import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="space-y-5">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        {paciente ? (
          <Link href={`/pacientes/${paciente.id}`} className="enlace truncate">{paciente.nombre}</Link>
        ) : (
          <Link href="/facturas" className="enlace">Facturas</Link>
        )}
        <span aria-hidden>/</span>
        <span>Nueva factura</span>
      </nav>
      <h1 className="titulo">Nueva factura</h1>

      {emisores.length === 0 ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          Todavía no están cargados los datos de las empresas que facturan. Hay que ejecutar
          «npm run cargar:emisores».
        </p>
      ) : (
        <FacturaForm emisores={emisores} hoy={hoyBogota()} pacienteInicial={paciente} />
      )}
    </div>
  );
}
