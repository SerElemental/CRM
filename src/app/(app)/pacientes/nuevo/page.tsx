import type { Metadata } from "next";
import Link from "next/link";
import { crearPaciente } from "../actions";
import { datosFormulario } from "../datos-formulario";
import { PacienteForm } from "../paciente-form";

export const metadata: Metadata = { title: "Nuevo paciente" };

export default async function NuevoPacientePage() {
  const datos = await datosFormulario();
  return (
    <div className="mx-auto max-w-[62.5rem] space-y-5">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        <Link href="/pacientes" className="enlace">Pacientes</Link>
        <span aria-hidden>/</span>
        <span>Nuevo</span>
      </nav>
      <h1 className="titulo">Nuevo paciente</h1>
      <PacienteForm action={crearPaciente} cancelarHref="/pacientes" {...datos} />
    </div>
  );
}
