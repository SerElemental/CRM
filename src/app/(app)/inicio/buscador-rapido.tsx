"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuscadorPacientes } from "../pacientes/buscador-pacientes";

/** Buscador de la pantalla de inicio: elegir a alguien abre su ficha; Enter lleva al listado filtrado. */
export function BuscadorRapido() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  return (
    <BuscadorPacientes
      valor={texto}
      alCambiar={setTexto}
      pendiente={false}
      placeholder="Buscar paciente"
      alEnviar={(q) => q && router.push(`/pacientes?q=${encodeURIComponent(q)}`)}
    />
  );
}
