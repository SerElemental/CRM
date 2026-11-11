import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { actualizarPaciente } from "../../actions";
import { datosFormulario } from "../../datos-formulario";
import { PacienteForm } from "../../paciente-form";

export const metadata: Metadata = { title: "Editar paciente" };

export default async function EditarPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: paciente }, datos] = await Promise.all([
    supabase.from("pacientes").select("*").eq("id", id).maybeSingle(),
    datosFormulario(id),
  ]);
  if (!paciente) notFound();

  return (
    <div className="mx-auto max-w-[62.5rem] space-y-5">
      <nav aria-label="Ruta" className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        <Link href="/pacientes" className="enlace">Pacientes</Link>
        <span aria-hidden>/</span>
        <Link href={`/pacientes/${id}`} className="enlace truncate">{paciente.nombre_completo}</Link>
        <span aria-hidden>/</span>
        <span>Editar</span>
      </nav>
      <h1 className="titulo">Editar paciente</h1>
      <PacienteForm
        action={actualizarPaciente.bind(null, id)}
        paciente={paciente}
        cancelarHref={`/pacientes/${id}`}
        {...datos}
      />
    </div>
  );
}
