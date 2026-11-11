import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, crearBase } from "./pglite";

let db: PGlite;
let staff: string;
let intruso: string;
let paciente: string;
let otroPaciente: string;

const uno = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const id = async (sql: string, params: unknown[] = []) => (await uno<{ id: string }>(sql, params)).id;

const ITEM = (valor: number, cantidad = 1) => ({ descripcion: "Sesión", cantidad, valorUnitario: valor });

/** Emite como el equipo y devuelve la factura creada. */
async function emitir(
  emisor: string, fecha: string, items: unknown[], sesiones: string[] = [], pacienteId: string | null = paciente,
) {
  return como(db, staff, async () => {
    const r = await uno<{ f: string }>(
      "select public.emitir_factura($1, $2, $3, $4, $5, null, $6) as f",
      [emisor, pacienteId, fecha, JSON.stringify({ nombre: "Cliente de Prueba" }), JSON.stringify(items), sesiones],
    );
    return uno<Record<string, unknown>>(
      "select id, numero, consecutivo, anio, moneda, total::float as total, estado, emisor ->> 'razonSocial' as razon from public.facturas where id = $1",
      [r.f],
    );
  });
}

beforeAll(async () => {
  db = await crearBase();
  staff = await id("insert into auth.users (email) values ('m@x.co') returning id");
  intruso = await id("insert into auth.users (email) values ('z@x.co') returning id");
  await db.query("insert into public.profiles (id, nombre) values ($1, 'Marcela')", [staff]);
  await db.query(
    `insert into public.emisores (clave, datos) values
       ('us', '{"prefijo":"INV","moneda":"USD","idioma":"en","razonSocial":"SER ELEMENTAL LLC"}'),
       ('co', '{"prefijo":"CC","moneda":"COP","idioma":"es","razonSocial":"Ser Elemental"}')`,
  );
  // EE. UU. ya había emitido una factura a mano este año: se continúa desde ahí.
  await db.query("insert into public.factura_consecutivos (emisor_clave, anio, ultimo) values ('us', 2026, 1)");
  paciente = await id("insert into public.pacientes (nombre_completo) values ('Ana Prueba') returning id");
  otroPaciente = await id("insert into public.pacientes (nombre_completo) values ('Luis Otro') returning id");
});

describe("emitir_factura", () => {
  it("numera por empresa y año, y guarda la foto de la empresa", async () => {
    expect(await emitir("us", "2026-11-11", [ITEM(130, 2)])).toMatchObject({
      numero: "INV-2026-0002", consecutivo: 2, anio: 2026, moneda: "USD", total: 260,
      estado: "emitida", razon: "SER ELEMENTAL LLC",
    });
    expect((await emitir("us", "2026-11-12", [ITEM(50)])).numero).toBe("INV-2026-0003");
    expect(await emitir("co", "2026-11-11", [ITEM(93000), ITEM(336000)])).toMatchObject({
      numero: "CC-2026-0001", moneda: "COP", total: 429000,
    });
    // Otro año empieza de nuevo en 1.
    expect((await emitir("us", "2027-01-05", [ITEM(130)])).numero).toBe("INV-2027-0001");
  });

  it("la foto no cambia aunque luego cambien los datos de la empresa", async () => {
    const f = await emitir("co", "2026-11-13", [ITEM(93000)]);
    await db.query(`update public.emisores set datos = datos || '{"razonSocial":"Otro Nombre"}' where clave = 'co'`);
    const despues = await uno<{ razon: string }>(
      "select emisor ->> 'razonSocial' as razon from public.facturas where id = $1", [f.id],
    );
    expect(despues.razon).toBe("Ser Elemental");
  });

  it("rechaza datos incompletos sin gastar consecutivo", async () => {
    const antes = await uno<{ ultimo: number }>(
      "select ultimo from public.factura_consecutivos where emisor_clave = 'co' and anio = 2026",
    );
    await expect(emitir("co", "2026-11-14", [])).rejects.toThrow(/al menos un renglón/);
    await expect(emitir("co", "2026-11-14", [{ descripcion: " ", cantidad: 1, valorUnitario: 1 }])).rejects.toThrow(/Cada renglón/);
    await expect(emitir("co", "2026-11-14", [ITEM(100, 0)])).rejects.toThrow(/Cada renglón/);
    await expect(emitir("xx", "2026-11-14", [ITEM(100)])).rejects.toThrow(/No existe la empresa/);
    const despues = await uno<{ ultimo: number }>(
      "select ultimo from public.factura_consecutivos where emisor_clave = 'co' and anio = 2026",
    );
    expect(despues.ultimo).toBe(antes.ultimo);
  });

  it("permite cobrarle a un tercero que no es paciente", async () => {
    const f = await emitir("co", "2026-11-14", [ITEM(400000)], [], null);
    expect(f.numero).toMatch(/^CC-2026-/);
  });
});

describe("sesiones y estados", () => {
  let s1: string;
  let s2: string;
  let factura: string;

  beforeAll(async () => {
    const crear = (p: string, n: number) =>
      id(
        "insert into public.sesiones (paciente_id, numero, fecha, asistencia, pago) values ($1, $2, '2026-11-10', 'realizada', 'sin_pagar') returning id",
        [p, n],
      );
    s1 = await crear(paciente, 1);
    s2 = await crear(paciente, 2);
    // Sesión antigua ya pagada, importada del Excel: no se ofrece para facturar.
    await db.query(
      "insert into public.sesiones (paciente_id, numero, asistencia, pago, origen) values ($1, 3, 'realizada', 'pagada', 'excel')",
      [paciente],
    );
  });

  const porFacturar = () =>
    como(db, staff, async () =>
      (await db.query<{ numero: number }>(
        "select numero from public.sesiones_por_facturar where paciente_id = $1 order by numero", [paciente],
      )).rows.map((r) => r.numero),
    );

  it("ofrece solo las sesiones pendientes de facturar", async () => {
    expect(await porFacturar()).toEqual([1, 2]);
  });

  it("una sesión no puede quedar en dos facturas, ni ser de otro paciente", async () => {
    factura = (await emitir("co", "2026-11-15", [ITEM(93000)], [s1])).id as string;
    expect(await porFacturar()).toEqual([2]);
    await expect(emitir("co", "2026-11-15", [ITEM(93000)], [s1])).rejects.toThrow(/ya está en otra factura/);
    await expect(emitir("co", "2026-11-15", [ITEM(93000)], [s2], otroPaciente)).rejects.toThrow(/no es de este paciente/);
  });

  it("marcar pagada también paga las sesiones que cubría; se puede reabrir", async () => {
    await como(db, staff, () => db.query("select public.marcar_factura_pagada($1, '2026-11-16')", [factura]));
    expect(await uno("select estado, pagada_el::text from public.facturas where id = $1", [factura]))
      .toEqual({ estado: "pagada", pagada_el: "2026-11-16" });
    expect((await uno<{ pago: string }>("select pago from public.sesiones where id = $1", [s1])).pago).toBe("pagada");
    await como(db, staff, async () => {
      await expect(db.query("select public.marcar_factura_pagada($1)", [factura])).rejects.toThrow(/factura emitida/);
      await db.query("select public.reabrir_factura($1)", [factura]);
    });
    expect((await uno<{ estado: string }>("select estado from public.facturas where id = $1", [factura])).estado).toBe("emitida");
    // Al quitar el pago, la sesión que esta factura había dejado pagada vuelve a «sin pagar».
    expect((await uno<{ pago: string }>("select pago from public.sesiones where id = $1", [s1])).pago).toBe("sin_pagar");
  });

  it("anular una factura pagada también devuelve sus sesiones a «sin pagar»", async () => {
    const f = (await emitir("co", "2026-11-15", [ITEM(93000)], [s2])).id as string;
    await como(db, staff, async () => {
      await db.query("select public.marcar_factura_pagada($1)", [f]);
      await db.query("select public.anular_factura($1, 'Se cobró dos veces')", [f]);
    });
    expect((await uno<{ pago: string }>("select pago from public.sesiones where id = $1", [s2])).pago).toBe("sin_pagar");
    expect(await porFacturar()).toEqual([2]);
  });

  it("anular conserva el número, exige motivo y libera las sesiones", async () => {
    await como(db, staff, async () => {
      await expect(db.query("select public.anular_factura($1, ' ')", [factura])).rejects.toThrow(/motivo/);
      await db.query("select public.anular_factura($1, 'Valor equivocado')", [factura]);
      await expect(db.query("select public.anular_factura($1, 'otra vez')", [factura])).rejects.toThrow(/ya estaba anulada/);
    });
    expect(await uno("select estado, anulada_motivo, numero is not null as con_numero from public.facturas where id = $1", [factura]))
      .toEqual({ estado: "anulada", anulada_motivo: "Valor equivocado", con_numero: true });
    const ligadas = await uno<{ n: number }>("select count(*)::int as n from public.factura_sesiones where factura_id = $1", [factura]);
    expect(ligadas.n).toBe(0);
  });
});

describe("repositorio y permisos", () => {
  it("los totales suman por moneda y dejan por fuera las anuladas", async () => {
    const filas = await como(db, staff, async () =>
      (await db.query(
        "select moneda, cantidad, total::float as total from public.facturas_totales('2026-11-01', '2026-11-30') order by moneda",
      )).rows,
    );
    // COP: 429.000 + 93.000 + 400.000 (la de 93.000 anulada no cuenta). USD: 260 + 50.
    expect(filas).toEqual([
      { moneda: "COP", cantidad: 3, total: 922000 },
      { moneda: "USD", cantidad: 2, total: 310 },
    ]);
    const soloUs = await como(db, staff, async () =>
      (await db.query("select cantidad from public.facturas_totales(null, null, 'us')")).rows,
    );
    expect(soloUs).toEqual([{ cantidad: 3 }]);
    const anuladas = await como(db, staff, async () =>
      (await db.query("select cantidad from public.facturas_totales(null, null, null, 'anulada')")).rows,
    );
    expect(anuladas).toEqual([{ cantidad: 2 }]);
  });

  it("el listado trae cliente y paciente, y se puede buscar por número", async () => {
    const fila = await como(db, staff, async () =>
      uno<Record<string, string>>(
        "select numero, cliente_nombre, paciente_nombre from public.facturas_listado where busqueda like '%inv-2026-0002%'",
      ),
    );
    expect(fila).toEqual({ numero: "INV-2026-0002", cliente_nombre: "Cliente de Prueba", paciente_nombre: "Ana Prueba" });
  });

  it("el equipo no puede escribir en las tablas directamente: solo por las funciones", async () => {
    await como(db, staff, async () => {
      await expect(db.query("update public.facturas set total = 1")).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.facturas")).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.emisores set activo = false")).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.factura_consecutivos set ultimo = 0")).rejects.toThrow(/permission denied/);
    });
  });

  it("una cuenta sin perfil no ve facturas ni puede emitir, pagar o anular", async () => {
    await como(db, intruso, async () => {
      for (const t of ["facturas", "facturas_listado", "emisores", "factura_sesiones", "sesiones_por_facturar"]) {
        const r = await uno<{ n: number }>(`select count(*)::int as n from public.${t}`);
        expect(r.n).toBe(0);
      }
      await expect(
        db.query("select public.emitir_factura('co', null, '2026-11-20', '{\"nombre\":\"X\"}', '[{\"descripcion\":\"a\",\"cantidad\":1,\"valorUnitario\":1}]')"),
      ).rejects.toThrow(/Sin acceso/);
      await expect(db.query("select public.anular_factura(gen_random_uuid(), 'x')")).rejects.toThrow(/Sin acceso/);
      await expect(db.query("select public.marcar_factura_pagada(gen_random_uuid())")).rejects.toThrow(/Sin acceso/);
    });
  });

  it("el rol anónimo no tiene permisos", async () => {
    await db.exec("set role anon");
    try {
      for (const t of ["facturas", "facturas_listado", "emisores", "sesiones_por_facturar"]) {
        await expect(db.query(`select 1 from public.${t} limit 1`)).rejects.toThrow(/permission denied/);
      }
      await expect(db.query("select * from public.facturas_totales()")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
