import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/pacientes/${id}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" /> {paciente.nombre_completo}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Editar paciente</h1>
      <PacienteForm
        action={actualizarPaciente.bind(null, id)}
        paciente={paciente}
        cancelarHref={`/pacientes/${id}`}
        {...datos}
      />
    </div>
  );
}
