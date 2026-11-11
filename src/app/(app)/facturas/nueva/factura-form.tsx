"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Iniciales } from "@/components/ui/iniciales";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PacienteParaFacturar } from "@/lib/facturas/paciente";
import { TEXTOS, dinero, fechaCorta, type Emisor } from "@/lib/facturas/tipos";
import { ASISTENCIA_LABEL, PAGO_LABEL } from "@/lib/sesiones";
import { MIN_LETRAS, resaltar, type Sugerencia } from "@/lib/sugerencias";
import { cn } from "@/lib/utils";
import { emitirFactura } from "../actions";

type Renglon = {
  clave: string;
  descripcion: string;
  fecha: string;
  cantidad: string;
  valorUnitario: string;
  sesionId: string | null;
};

const NOMBRE_PAIS: Record<string, string> = { co: "Colombia", us: "Estados Unidos" };

let contador = 0;
const nuevaClave = () => `r${++contador}`;

/** Valor de consulta del paciente en la moneda de la empresa (el del año más reciente). */
function tarifaEn(paciente: PacienteParaFacturar | null, moneda: string): string {
  const t = paciente?.tarifas.find((x) => x.moneda === moneda);
  return t ? String(t.valor) : "";
}

function renglonDeSesion(
  s: PacienteParaFacturar["sesiones"][number], paciente: PacienteParaFacturar, emisor: Emisor,
): Renglon {
  return {
    clave: nuevaClave(),
    descripcion: TEXTOS[emisor.idioma].sesion,
    fecha: s.fecha ?? "",
    cantidad: "1",
    // El valor registrado en la sesión, si está en la moneda de la empresa; si no, la tarifa del paciente.
    valorUnitario: s.valor != null && s.moneda === emisor.moneda ? String(s.valor) : tarifaEn(paciente, emisor.moneda),
    sesionId: s.id,
  };
}

const numero = (v: string) => Number(v.replace(",", "."));

/** Paso numerado del formulario. Todos van en un solo panel, separados por una línea. */
function Seccion({
  paso, titulo, ayuda, children,
}: {
  paso: string; titulo: string; ayuda?: string; children: React.ReactNode;
}) {
  return (
    <section className="border-border space-y-4 border-b px-5 py-6 last:border-b-0 md:px-7">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-[-0.01em]">
          <span className="text-muted-foreground mr-2.5 font-mono text-[0.8125rem] font-normal">{paso}</span>
          {titulo}
        </h2>
        {ayuda && <p className="text-muted-foreground text-[0.8125rem]">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

/** Nombre del <iframe> donde se dibuja el PDF de vista previa. */
const MARCO_PREVIA = "vista-previa-factura";
/** Milisegundos sin cambios antes de volver a generar la vista previa. */
const ESPERA_PREVIA = 800;

/** Buscador de paciente con autocompletado: al elegir uno, lo entrega al formulario. */
function SelectorPaciente({ alElegir }: { alElegir: (id: string) => void }) {
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const consulta = texto.trim();
  const suficiente = consulta.length >= MIN_LETRAS;

  useEffect(() => {
    if (!suficiente) return;
    const control = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/pacientes/sugerencias?q=${encodeURIComponent(consulta)}`, { signal: control.signal });
        if (!r.ok) throw new Error(String(r.status));
        setSugerencias(((await r.json()) as { sugerencias: Sugerencia[] }).sugerencias);
        setActivo(-1);
      } catch {
        // Cancelada o sin conexión: se deja lo que había.
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [consulta, suficiente]);

  useEffect(() => {
    const alPulsar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", alPulsar);
    return () => document.removeEventListener("pointerdown", alPulsar);
  }, []);

  const lista = suficiente ? sugerencias : [];
  const visible = abierto && suficiente;
  const elegir = (s: Sugerencia) => {
    setAbierto(false);
    setTexto("");
    alElegir(s.id);
  };

  return (
    <div ref={caja} className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3.5 size-4" />
      <Input
        type="search" role="combobox" aria-label="Buscar paciente" aria-autocomplete="list"
        aria-expanded={visible} aria-controls={idLista} autoComplete="off"
        aria-activedescendant={visible && activo >= 0 ? `${idLista}-${activo}` : undefined}
        value={texto} placeholder="Buscar paciente por nombre, teléfono o correo" className="pr-10 pl-10"
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && lista.length) {
            e.preventDefault();
            const paso = e.key === "ArrowDown" ? 1 : -1;
            setActivo((i) => (i + paso + lista.length) % lista.length);
          } else if (e.key === "Enter") {
            // Enter nunca envía el formulario de la factura desde aquí.
            e.preventDefault();
            const s = lista[activo >= 0 ? activo : 0];
            if (visible && s) elegir(s);
          }
        }}
      />
      {buscando && <Loader2 className="text-muted-foreground absolute top-3 right-3 size-4 animate-spin" />}
      {visible && (
        <div className="bg-popover border-input absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border shadow-lg">
          {lista.length === 0 && !buscando ? (
            <p className="text-muted-foreground px-3.5 py-3 text-sm">Ningún paciente coincide con «{consulta}».</p>
          ) : (
            <ul id={idLista} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
              {lista.map((s, i) => (
                <li
                  key={s.id} id={`${idLista}-${i}`} role="option" aria-selected={i === activo}
                  onPointerDown={(e) => { e.preventDefault(); elegir(s); }}
                  onPointerMove={() => setActivo(i)}
                  className={cn("cursor-pointer rounded-md px-2.5 py-2 text-sm", i === activo && "bg-accent")}
                >
                  {resaltar(s.nombre_completo, consulta).map((t, k) => (
                    <span key={k} className={t.coincide ? "font-semibold" : "text-muted-foreground"}>{t.texto}</span>
                  ))}
                  <span className="text-muted-foreground ml-2 text-xs">{[s.telefono, s.pais].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function FacturaForm({
  emisores, hoy, pacienteInicial,
}: {
  emisores: Emisor[];
  hoy: string;
  pacienteInicial: PacienteParaFacturar | null;
}) {
  const idForm = useId();
  const [confirmar, setConfirmar] = useState(false);
  // Si todo sale bien, la acción redirige a la factura; si vuelve, es con un error:
  // se cierra el diálogo de confirmación para que el mensaje quede a la vista.
  const [state, formAction, emitiendo] = useActionState(
    async (prev: Awaited<ReturnType<typeof emitirFactura>>, fd: FormData) => {
      const r = await emitirFactura(prev, fd);
      setConfirmar(false);
      return r;
    },
    undefined,
  );

  // Por defecto, la empresa del país del paciente; si no se sabe, la primera.
  const emisorInicial =
    emisores.find((e) => (pacienteInicial?.pais === "Colombia" ? e.clave === "co" : pacienteInicial?.pais ? e.clave === "us" : false)) ??
    emisores[0];
  const [claveEmisor, setClaveEmisor] = useState(emisorInicial.clave);
  const emisor = emisores.find((e) => e.clave === claveEmisor) ?? emisores[0];

  const [fecha, setFecha] = useState(hoy);
  const [paciente, setPaciente] = useState(pacienteInicial);
  const [cargando, setCargando] = useState(false);
  const [errorPaciente, setErrorPaciente] = useState<string | null>(null);
  const [cliente, setCliente] = useState({
    nombre: pacienteInicial?.nombre ?? "",
    identificacion: pacienteInicial?.documento ?? "",
    email: pacienteInicial?.email ?? "",
    telefono: pacienteInicial?.telefono ?? "",
    direccion: "",
  });
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [notas, setNotas] = useState("");

  const t = TEXTOS[emisor.idioma];
  const total = renglones.reduce((n, r) => n + (numero(r.cantidad) || 0) * (numero(r.valorUnitario) || 0), 0);
  const usadas = new Set(renglones.map((r) => r.sesionId).filter(Boolean));

  const elegirPaciente = async (id: string) => {
    setCargando(true);
    setErrorPaciente(null);
    try {
      const r = await fetch(`/facturas/nueva/datos?paciente=${id}`);
      if (!r.ok) throw new Error(String(r.status));
      const p = ((await r.json()) as { paciente: PacienteParaFacturar }).paciente;
      setPaciente(p);
      setCliente({ nombre: p.nombre, identificacion: p.documento ?? "", email: p.email ?? "", telefono: p.telefono ?? "", direccion: "" });
      // Las sesiones marcadas eran del paciente anterior.
      setRenglones((rs) => rs.filter((x) => !x.sesionId));
    } catch {
      setErrorPaciente("No se pudieron cargar los datos del paciente. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const quitarPaciente = () => {
    setPaciente(null);
    setRenglones((rs) => rs.filter((x) => !x.sesionId));
  };

  const cambiarEmisor = (clave: string) => {
    const nuevo = emisores.find((e) => e.clave === clave);
    if (!nuevo) return;
    setClaveEmisor(clave);
    // Cambian idioma y moneda: los renglones de sesiones se rehacen con los valores de esa empresa.
    setRenglones((rs) =>
      rs.map((r) => {
        const s = r.sesionId ? paciente?.sesiones.find((x) => x.id === r.sesionId) : null;
        return s && paciente ? { ...renglonDeSesion(s, paciente, nuevo), clave: r.clave } : r;
      }),
    );
  };

  const alternarSesion = (s: PacienteParaFacturar["sesiones"][number]) => {
    if (!paciente) return;
    setRenglones((rs) =>
      rs.some((r) => r.sesionId === s.id)
        ? rs.filter((r) => r.sesionId !== s.id)
        : [...rs, renglonDeSesion(s, paciente, emisor)],
    );
  };

  const editar = (clave: string, campo: keyof Renglon, valor: string) =>
    setRenglones((rs) => rs.map((r) => (r.clave === clave ? { ...r, [campo]: valor } : r)));

  const datos = JSON.stringify({
    emisor: emisor.clave,
    pacienteId: paciente?.id ?? null,
    fecha,
    cliente,
    items: renglones.map(({ descripcion, fecha: f, cantidad, valorUnitario, sesionId }) => ({
      descripcion, fecha: f, cantidad: cantidad.replace(",", "."), valorUnitario: valorUnitario.replace(",", "."), sesionId,
    })),
    notas,
  });
  const listo = cliente.nombre.trim().length >= 2 && renglones.length > 0 &&
    renglones.every((r) => r.descripcion.trim() && numero(r.cantidad) > 0 && r.valorUnitario.trim() !== "" && numero(r.valorUnitario) >= 0);

  // Vista previa en vivo (solo en pantallas anchas): tras una pausa al escribir, un
  // formulario oculto envía los mismos datos a /facturas/vista-previa y el PDF se
  // dibuja en el marco de al lado. No guarda nada.
  const formPrevia = useRef<HTMLFormElement>(null);
  const [hayPrevia, setHayPrevia] = useState(false);
  useEffect(() => {
    if (!listo || !window.matchMedia("(min-width: 1024px)").matches) return;
    const t = setTimeout(() => {
      formPrevia.current?.submit();
      setHayPrevia(true);
    }, ESPERA_PREVIA);
    return () => clearTimeout(t);
  }, [datos, listo]);

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
      <form id={idForm} action={formAction} className="min-w-0 flex-1 space-y-4">
        <input type="hidden" name="datos" value={datos} />

        <div className="panel">
          <Seccion paso="01" titulo="Empresa que factura" ayuda="Define el idioma, la moneda, la numeración y los datos de pago del documento.">
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Empresa que factura">
              {emisores.map((e) => (
                <label
                  key={e.clave}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors",
                    e.clave === emisor.clave ? "border-foreground bg-accent" : "border-input hover:bg-muted",
                  )}
                >
                  <input
                    type="radio" name="empresa" value={e.clave} checked={e.clave === emisor.clave}
                    onChange={() => cambiarEmisor(e.clave)} className="accent-primary mt-0.5 size-[1.125rem]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{NOMBRE_PAIS[e.clave] ?? e.ciudad}</span>
                    <span className="text-secondary-foreground block text-[0.8125rem]">
                      {e.nombreDocumento} · {e.moneda} · serie {e.prefijo}
                    </span>
                    <span className="text-muted-foreground block text-[0.8125rem]">{e.razonSocial}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="max-w-60 space-y-1.5">
              <Label htmlFor="fecha">Fecha de emisión</Label>
              <Input id="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required />
            </div>
          </Seccion>

          <Seccion paso="02" titulo="Paciente" ayuda="Opcional: déjalo vacío si el cobro es a una empresa o a alguien que no es paciente.">
            {paciente ? (
              <div className="border-input flex items-center gap-3 rounded-lg border py-2.5 pr-2 pl-3.5">
                <Iniciales nombre={paciente.nombre} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{paciente.nombre}</p>
                  <p className="text-muted-foreground truncate text-[0.8125rem]">
                    {[
                      paciente.sesiones.length === 1 ? "1 sesión sin facturar" : `${paciente.sesiones.length} sesiones sin facturar`,
                      paciente.telefono, paciente.pais,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-link" onClick={quitarPaciente}>Cambiar</Button>
              </div>
            ) : (
              <SelectorPaciente alElegir={elegirPaciente} />
            )}
            {cargando && <p className="text-muted-foreground text-[0.8125rem]">Cargando datos del paciente…</p>}
            {errorPaciente && <p role="alert" className="text-destructive text-[0.8125rem]">{errorPaciente}</p>}
          </Seccion>

          <Seccion paso="03" titulo="A nombre de quién va" ayuda="Viene con los datos del paciente; cámbialos si paga una empresa o un familiar.">
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-nombre">Nombre o razón social</Label>
                <Input id="c-nombre" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-id">Identificación</Label>
                <Input
                  id="c-id" value={cliente.identificacion} placeholder={emisor.idioma === "es" ? "C.C. o NIT" : "EIN, passport…"}
                  onChange={(e) => setCliente({ ...cliente, identificacion: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Correo</Label>
                <Input id="c-email" type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-tel">Teléfono</Label>
                <Input id="c-tel" type="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-dir">Dirección</Label>
                <Input id="c-dir" value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} />
              </div>
            </div>
          </Seccion>

          <Seccion paso="04" titulo="Qué se cobra">
            {paciente && paciente.sesiones.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Sesiones de {paciente.nombre} sin facturar</p>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {paciente.sesiones.map((s) => (
                    <li key={s.id}>
                      <label
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 text-sm transition-colors",
                          usadas.has(s.id) ? "border-foreground bg-accent" : "border-input hover:bg-muted",
                        )}
                      >
                        <input type="checkbox" checked={usadas.has(s.id)} onChange={() => alternarSesion(s)} className="accent-primary size-[1.125rem]" />
                        <span className="flex-1">
                          Sesión {s.numero}
                          <span className="text-secondary-foreground"> · {s.fecha ? fechaCorta(s.fecha, "es") : "sin fecha"}</span>
                        </span>
                        <span className="text-warning-foreground text-[0.8125rem] font-medium">
                          {s.asistencia === "perdida" ? ASISTENCIA_LABEL.perdida : PAGO_LABEL[s.pago]}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {paciente && paciente.sesiones.length === 0 && (
              <p className="text-muted-foreground text-[0.8125rem]">
                Este paciente no tiene sesiones pendientes de facturar. Puedes agregar renglones a mano.
              </p>
            )}

            {renglones.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="rotulo text-left">
                      <th className="pb-2 font-medium">Descripción</th>
                      <th className="w-36 pb-2 pl-2 font-medium">Fecha</th>
                      <th className="w-16 pb-2 pl-2 font-medium">Cant.</th>
                      <th className="w-32 pb-2 pl-2 font-medium">Valor ({emisor.moneda})</th>
                      <th className="w-28 pb-2 pl-2 text-right font-medium">Subtotal</th>
                      <th className="w-9 pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {renglones.map((r, i) => (
                      <tr key={r.clave} className="align-top">
                        <td className="pb-2">
                          <Input value={r.descripcion} aria-label={`Descripción del renglón ${i + 1}`} onChange={(e) => editar(r.clave, "descripcion", e.target.value)} />
                        </td>
                        <td className="pb-2 pl-2">
                          <Input type="date" value={r.fecha} aria-label={`Fecha del renglón ${i + 1}`} onChange={(e) => editar(r.clave, "fecha", e.target.value)} />
                        </td>
                        <td className="pb-2 pl-2">
                          <Input inputMode="decimal" value={r.cantidad} aria-label={`Cantidad del renglón ${i + 1}`} className="text-right" onChange={(e) => editar(r.clave, "cantidad", e.target.value)} />
                        </td>
                        <td className="pb-2 pl-2">
                          <Input
                            inputMode="decimal" value={r.valorUnitario} aria-label={`Valor del renglón ${i + 1}`} className="text-right tabular-nums"
                            placeholder="0" onChange={(e) => editar(r.clave, "valorUnitario", e.target.value)}
                          />
                        </td>
                        <td className="pt-2.5 pb-2 pl-2 text-right tabular-nums">
                          {dinero((numero(r.cantidad) || 0) * (numero(r.valorUnitario) || 0), emisor.moneda)}
                        </td>
                        <td className="pb-2 pl-1">
                          <Button
                            type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Quitar el renglón ${i + 1}`}
                            onClick={() => setRenglones((rs) => rs.filter((x) => x.clave !== r.clave))}
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              type="button" variant="outline" size="sm" className="border-dashed"
              onClick={() =>
                setRenglones((rs) => [
                  ...rs,
                  { clave: nuevaClave(), descripcion: t.sesion, fecha: "", cantidad: "1", valorUnitario: tarifaEn(paciente, emisor.moneda), sesionId: null },
                ])
              }
            >
              <Plus /> Agregar renglón
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="notas">Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <textarea
                id="notas" rows={2} className="control" value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Orden de compra, plazo de pago…"
              />
            </div>
          </Seccion>
        </div>

        {state?.error && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">{state.error}</p>
        )}

        {/* Fija abajo: el total y «Emitir» siempre a la vista. En el móvil queda sobre la navegación. */}
        <div className="panel border-input sticky bottom-[4.75rem] z-20 flex flex-wrap items-center justify-between gap-3 py-3 pr-4 pl-5 shadow-md md:bottom-4">
          <p className="flex items-baseline gap-2.5">
            <span className="rotulo">Total</span>
            <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{dinero(total, emisor.moneda)}</span>
            <span className="text-muted-foreground text-[0.8125rem]">{emisor.moneda}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/facturas" className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
            {/* Mismo formulario, otra dirección: abre el PDF en una pestaña nueva sin guardar nada.
                En pantallas anchas ya se ve al lado; aquí queda para el móvil. */}
            <Button
              type="submit" variant="outline" disabled={!listo} className="lg:hidden"
              formAction="/facturas/vista-previa" formMethod="post" formTarget="_blank"
            >
              Vista previa
            </Button>
            <Dialog open={confirmar} onOpenChange={setConfirmar}>
              <DialogTrigger render={<Button type="button" disabled={!listo || emitiendo} />}>
                Emitir {emisor.nombreDocumento.toLowerCase()}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Emitir {emisor.nombreDocumento.toLowerCase()}?</DialogTitle>
                  <DialogDescription>
                    A nombre de {cliente.nombre || "…"} por {dinero(total, emisor.moneda)} {emisor.moneda}. Tomará el siguiente
                    número de {NOMBRE_PAIS[emisor.clave] ?? emisor.razonSocial} y ya no se podrá editar: solo marcar como
                    pagada o anular.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setConfirmar(false)}>Volver</Button>
                  {/* El diálogo se dibuja fuera del <form>: `form` lo vuelve a unir. */}
                  <Button type="submit" form={idForm} disabled={emitiendo}>
                    {emitiendo ? "Emitiendo…" : "Sí, emitir"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </form>

      <aside aria-label="Vista previa del documento" className="sticky top-6 hidden w-[26rem] shrink-0 space-y-2.5 lg:block xl:w-[29rem]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="rotulo">Vista previa</p>
          <p className="text-muted-foreground text-[0.8125rem]">Se actualiza mientras escribes</p>
        </div>
        <div className="border-input bg-card relative aspect-[8.5/11] overflow-hidden rounded-sm border">
          <iframe name={MARCO_PREVIA} title="Vista previa del documento" className="size-full" />
          {!(hayPrevia && listo) && (
            <p className="bg-card text-muted-foreground absolute inset-0 flex items-center justify-center px-10 text-center text-sm">
              Completa a nombre de quién va y al menos un renglón para ver el documento.
            </p>
          )}
        </div>
        {/* Formulario aparte (no puede ir dentro del otro): solo sirve para pedir el PDF de vista previa. */}
        <form ref={formPrevia} action="/facturas/vista-previa" method="post" target={MARCO_PREVIA}>
          <input type="hidden" name="datos" value={datos} />
          <Button type="submit" variant="outline" size="sm" formTarget="_blank" disabled={!listo}>
            <ExternalLink /> Abrir el PDF en otra pestaña
          </Button>
        </form>
      </aside>
    </div>
  );
}
