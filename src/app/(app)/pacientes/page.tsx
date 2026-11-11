import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Plus, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { PacienteEstado } from "@/lib/database.types";
import { formatearFecha } from "@/lib/fecha";
import {
  ESTADO_BADGE, ESTADO_LABEL, ESTADOS, MODALIDADES, TIPO_LABEL, normalizarBusqueda,
} from "@/lib/pacientes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pacientes" };

// Se muestran todos de una vez (la base tiene unos 550). 1.000 es el tope que
// devuelve Supabase por consulta: si algún día se supera, aparece la paginación.
const POR_PAGINA = 1000;

type Filtros = {
  q?: string; estado?: string; grupo?: string; modalidad?: string;
  miembro?: string; flyer?: string; saldo?: string; contacto?: string; pagina?: string;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f: Filtros = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, uno(v)]));
  // Por defecto se ven TODOS los pacientes, activos o no; las pestañas filtran.
  const estado = f.estado ?? "todos";
  const pagina = Math.max(1, Number(f.pagina) || 1);

  const supabase = await createClient();
  const [{ data: grupos }, resultado] = await Promise.all([
    supabase.from("grupos_whatsapp").select("id, nombre").order("id"),
    (() => {
      let q = supabase
        .from("pacientes_listado")
        .select(
          "id, nombre_completo, tipo, estado, telefono, grupo_whatsapp, es_miembro, no_contactar, ultima_sesion, sesiones_realizadas, sesiones_por_cobrar, sesiones_prepagadas",
          { count: "exact" },
        );
      if (estado !== "todos" && ESTADOS.some((e) => e.value === estado)) q = q.eq("estado", estado as PacienteEstado);
      if (f.q) {
        const texto = normalizarBusqueda(f.q).replace(/[\\%_]/g, "\\$&");
        if (texto) q = q.ilike("busqueda", `%${texto}%`);
      }
      if (f.grupo === "ninguno") q = q.is("grupo_whatsapp_id", null);
      else if (f.grupo && /^\d+$/.test(f.grupo)) q = q.eq("grupo_whatsapp_id", Number(f.grupo));
      if (f.modalidad === "online" || f.modalidad === "presencial") q = q.eq("modalidad", f.modalidad);
      if (f.miembro === "si") q = q.eq("es_miembro", true);
      if (f.miembro === "no") q = q.eq("es_miembro", false);
      if (f.miembro === "invitado") q = q.eq("es_miembro", false).eq("correo_membresia_enviado", true);
      if (f.flyer === "si") q = q.eq("flyer_enviado", true);
      if (f.flyer === "no") q = q.eq("flyer_enviado", false);
      if (f.saldo === "por_cobrar") q = q.gt("sesiones_por_cobrar", 0);
      if (f.saldo === "prepagadas") q = q.gt("sesiones_prepagadas", 0);
      if (f.contacto === "no_contactar") q = q.eq("no_contactar", true);
      if (f.contacto === "contactable") q = q.eq("no_contactar", false);
      return q
        .order("nombre_completo")
        .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    })(),
  ]);

  const pacientes = resultado.data ?? [];
  const total = resultado.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /** URL del listado conservando los filtros actuales. */
  const url = (cambios: Partial<Filtros>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, estado, pagina: undefined, ...cambios })) if (v) p.set(k, String(v));
    return `/pacientes?${p}`;
  };
  const hayFiltros = Boolean(f.q || f.grupo || f.modalidad || f.miembro || f.flyer || f.saldo || f.contacto);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "paciente" : "pacientes"}
            {estado !== "todos" && ` · ${ESTADO_LABEL[estado as PacienteEstado] ?? ""}`}
          </p>
        </div>
        <Link href="/pacientes/nuevo" className={buttonVariants()}>
          <Plus /> Nuevo paciente
        </Link>
      </div>

      {/* Estado: pestañas */}
      <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
        {[{ value: "todos", label: "Todos" }, ...ESTADOS].map((e) => (
          <Link
            key={e.value}
            href={url({ estado: e.value })}
            aria-current={estado === e.value ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              estado === e.value
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {e.label}
          </Link>
        ))}
      </nav>

      {/* Búsqueda y filtros (formulario GET: la URL es el estado) */}
      <form action="/pacientes" className="bg-card ring-foreground/[0.06] grid gap-3 rounded-xl p-4 shadow-sm ring-1 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="estado" value={estado} />
        <div className="relative sm:col-span-2 lg:col-span-6">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
          <Input name="q" defaultValue={f.q ?? ""} placeholder="Buscar por nombre, teléfono o correo" className="pl-9" aria-label="Buscar paciente" />
        </div>
        <select name="grupo" defaultValue={f.grupo ?? ""} className="control" aria-label="Grupo de WhatsApp">
          <option value="">Grupo WhatsApp</option>
          {(grupos ?? []).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          <option value="ninguno">Sin grupo</option>
        </select>
        <select name="modalidad" defaultValue={f.modalidad ?? ""} className="control" aria-label="Modalidad">
          <option value="">Modalidad</option>
          {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select name="miembro" defaultValue={f.miembro ?? ""} className="control" aria-label="Membresía">
          <option value="">Membresía</option>
          <option value="si">Miembros</option>
          <option value="invitado">Invitados, no inscritos</option>
          <option value="no">No miembros</option>
        </select>
        <select name="flyer" defaultValue={f.flyer ?? ""} className="control" aria-label="Flyer de seguimiento">
          <option value="">Flyer</option>
          <option value="si">Flyer enviado</option>
          <option value="no">Sin flyer</option>
        </select>
        <select name="saldo" defaultValue={f.saldo ?? ""} className="control" aria-label="Saldo de sesiones">
          <option value="">Saldo</option>
          <option value="por_cobrar">Con sesiones por cobrar</option>
          <option value="prepagadas">Con sesiones prepagadas</option>
        </select>
        <select name="contacto" defaultValue={f.contacto ?? ""} className="control" aria-label="Contacto">
          <option value="">Contacto</option>
          <option value="contactable">Se puede contactar</option>
          <option value="no_contactar">No volver a contactar</option>
        </select>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm">Aplicar filtros</Button>
          {hayFiltros && (
            <Link href={url({ q: undefined, grupo: undefined, modalidad: undefined, miembro: undefined, flyer: undefined, saldo: undefined, contacto: undefined })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {resultado.error ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          No se pudieron cargar los pacientes. Recarga la página.
        </p>
      ) : pacientes.length === 0 ? (
        <div className="tabla-wrap">
          <EmptyState
            icon={Users}
            title="No hay pacientes con estos filtros"
            description="Prueba con otro estado o limpia la búsqueda."
          />
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Estado</th>
                <th>Grupo WhatsApp</th>
                <th>Membresía</th>
                <th>Última sesión</th>
                <th className="text-right">Sesiones</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pacientes/${p.id}`} className="hover:text-primary font-medium">
                      {p.nombre_completo}
                    </Link>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                      {p.tipo !== "individual" && <span>{TIPO_LABEL[p.tipo]}</span>}
                      {p.telefono && <span>{p.telefono}</span>}
                      {p.no_contactar && (
                        <span className="text-destructive inline-flex items-center gap-1">
                          <Ban className="size-3" /> No contactar
                        </span>
                      )}
                    </div>
                  </td>
                  <td><Badge variant={ESTADO_BADGE[p.estado]}>{ESTADO_LABEL[p.estado]}</Badge></td>
                  <td className="text-muted-foreground">{p.grupo_whatsapp ?? "—"}</td>
                  <td>{p.es_miembro ? <Badge variant="outline">Miembro</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-muted-foreground whitespace-nowrap">{formatearFecha(p.ultima_sesion)}</td>
                  <td className="text-right tabular-nums">{p.sesiones_realizadas}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {p.sesiones_por_cobrar > 0 && <Badge variant="warning">{p.sesiones_por_cobrar} por cobrar</Badge>}
                      {p.sesiones_prepagadas > 0 && (
                        <Badge variant="outline" className="border-info/40 text-info">
                          {p.sesiones_prepagadas} {p.sesiones_prepagadas === 1 ? "prepagada" : "prepagadas"}
                        </Badge>
                      )}
                      {p.sesiones_por_cobrar === 0 && p.sesiones_prepagadas === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-muted-foreground">
            Página {pagina} de {paginas} · {total} pacientes en total
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link href={url({ pagina: String(pagina - 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Anterior
              </Link>
            )}
            {pagina < paginas && (
              <Link href={url({ pagina: String(pagina + 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
