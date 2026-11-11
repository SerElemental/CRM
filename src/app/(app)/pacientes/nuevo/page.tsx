import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearPaciente } from "../actions";
import { datosFormulario } from "../datos-formulario";
import { PacienteForm } from "../paciente-form";

export const metadata: Metadata = { title: "Nuevo paciente" };

export default async function NuevoPacientePage() {
  const datos = await datosFormulario();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/pacientes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" /> Pacientes
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo paciente</h1>
      <PacienteForm action={crearPaciente} cancelarHref="/pacientes" {...datos} />
    </div>
  );
}
