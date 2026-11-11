import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, crearBase } from "./pglite";

let db: PGlite;
let staff: string;
let intruso: string;
let paciente: string;

const uno = async <T,>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await crearBase();
  staff = (await uno<{ id: string }>("insert into auth.users (email) values ('m@x.co') returning id")).id;
  intruso = (await uno<{ id: string }>("insert into auth.users (email) values ('z@x.co') returning id")).id;
  await db.query("insert into public.profiles (id, nombre) values ($1, 'Marcela')", [staff]);
  paciente = await como(db, staff, async () =>
    (await uno<{ id: string }>(
      "insert into public.pacientes (nombre_completo, telefono) values ('Adrián Peña', '300 111') returning id",
    )).id,
  );
  await db.query(
    "insert into public.paciente_tarifas (paciente_id, anio, valor, moneda) values ($1, 2025, 83000, 'COP'), ($1, 2026, 93000, 'COP')",
    [paciente],
  );
});

describe("migraciones", () => {
  it("siembra los catálogos", async () => {
    const g = await db.query("select nombre from public.grupos_whatsapp order by id");
    expect(g.rows).toEqual([{ nombre: "Pacientes" }, { nombre: "Pacientes 2" }]);
    const p = await uno<{ n: number }>("select count(*)::int as n from public.planes_membresia");
    expect(p.n).toBe(3);
  });

  it("asigna número y texto de búsqueda sin tildes", async () => {
    const p = await uno<{ numero: number; busqueda: string }>(
      "select numero, busqueda from public.pacientes where id = $1", [paciente],
    );
    expect(p.numero).toBe(1);
    expect(p.busqueda).toBe("adrian pena 300 111");
  });

  it("una cuenta sin perfil no ve ni escribe pacientes", async () => {
    await como(db, intruso, async () => {
      const r = await uno<{ n: number }>("select count(*)::int as n from public.pacientes");
      expect(r.n).toBe(0);
      const l = await uno<{ n: number }>("select count(*)::int as n from public.pacientes_listado");
      expect(l.n).toBe(0);
      await expect(
        db.query("insert into public.pacientes (nombre_completo) values ('X')"),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("el rol anónimo no tiene permisos sobre las tablas ni las funciones", async () => {
    await db.exec("set role anon");
    try {
      for (const t of ["pacientes", "pacientes_listado", "sesiones", "paciente_tarifas", "profiles"]) {
        await expect(db.query(`select 1 from public.${t} limit 1`)).rejects.toThrow(/permission denied/);
      }
      await expect(db.query("select public.registrar_paquete($1, 1)", [paciente])).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("un perfil inactivo pierde el acceso", async () => {
    await db.query("insert into public.profiles (id, activo) values ($1, false)", [intruso]);
    await como(db, intruso, async () => {
      const r = await uno<{ n: number }>("select count(*)::int as n from public.pacientes");
      expect(r.n).toBe(0);
    });
  });
});

describe("sesiones", () => {
  const resumen = () =>
    uno<Record<string, number>>(
      `select sesiones_total, sesiones_realizadas, sesiones_por_cobrar, sesiones_prepagadas, sesiones_perdidas
         from public.pacientes_listado where id = $1`, [paciente],
    );

  it("crea una sesión nueva con el valor del año y actualiza la última sesión", async () => {
    await como(db, staff, () =>
      db.query("select public.registrar_sesion($1, '2026-11-05', 'realizada', 'sin_pagar', 'primera')", [paciente]),
    );
    const s = await uno<Record<string, unknown>>(
      "select numero, valor::int as valor, moneda, nota, origen from public.sesiones where paciente_id = $1", [paciente],
    );
    expect(s).toEqual({ numero: 1, valor: 93000, moneda: "COP", nota: "primera", origen: "crm" });
    const p = await uno<{ u: string }>("select ultima_sesion::text as u from public.pacientes where id = $1", [paciente]);
    expect(p.u).toBe("2026-11-05");
    expect(await resumen()).toEqual({
      sesiones_total: 1, sesiones_realizadas: 1, sesiones_por_cobrar: 1, sesiones_prepagadas: 0, sesiones_perdidas: 0,
    });
  });

  it("un paquete crea sesiones prepagadas y las siguientes sesiones las consumen en orden", async () => {
    await como(db, staff, async () => {
      await db.query("select public.registrar_paquete($1, 3)", [paciente]);
      await db.query("select public.registrar_sesion($1, '2026-11-12', 'realizada', 'pagada')", [paciente]);
      await db.query("select public.registrar_sesion($1, '2026-11-19', 'perdida', 'no_aplica', 'no asistió')", [paciente]);
    });
    const filas = await db.query(
      "select numero, fecha::text as fecha, asistencia, pago from public.sesiones where paciente_id = $1 order by numero", [paciente],
    );
    expect(filas.rows).toEqual([
      { numero: 1, fecha: "2026-11-05", asistencia: "realizada", pago: "sin_pagar" },
      { numero: 2, fecha: "2026-11-12", asistencia: "realizada", pago: "paquete" },
      { numero: 3, fecha: "2026-11-19", asistencia: "perdida", pago: "paquete" },
      { numero: 4, fecha: null, asistencia: "pendiente", pago: "paquete" },
    ]);
    expect(await resumen()).toEqual({
      sesiones_total: 4, sesiones_realizadas: 2, sesiones_por_cobrar: 1, sesiones_prepagadas: 1, sesiones_perdidas: 1,
    });
    // Una sesión perdida no adelanta la «última sesión».
    const p = await uno<{ u: string }>("select ultima_sesion::text as u from public.pacientes where id = $1", [paciente]);
    expect(p.u).toBe("2026-11-12");
  });

  it("rechaza paquetes fuera de rango y sesiones 'pendiente'", async () => {
    await como(db, staff, async () => {
      await expect(db.query("select public.registrar_paquete($1, 0)", [paciente])).rejects.toThrow(/entre 1 y 50/);
      await expect(
        db.query("select public.registrar_sesion($1, '2026-11-20', 'pendiente', 'paquete')", [paciente]),
      ).rejects.toThrow(/realizada o perdida/);
    });
  });

  it("una cuenta sin perfil no puede registrar sesiones", async () => {
    const otro = (await uno<{ id: string }>("insert into auth.users (email) values ('q@x.co') returning id")).id;
    await como(db, otro, async () => {
      await expect(
        db.query("select public.registrar_sesion($1, '2026-11-20', 'realizada', 'pagada')", [paciente]),
      ).rejects.toThrow(/row-level security/);
    });
  });
});
