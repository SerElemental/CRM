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
  await db.query("insert into public.profiles (id, nombre) values ($1, 'Marcela Salazar')", [staff]);
  paciente = await como(db, staff, async () =>
    (await uno<{ id: string }>(
      "insert into public.pacientes (nombre_completo, modalidad) values ('Ana Ejemplo', 'online') returning id",
    )).id,
  );
});

describe("historias clínicas", () => {
  it("abre la historia con consecutivo y lo deja en el historial", async () => {
    await como(db, staff, async () => {
      const h = await uno<{ numero: number }>(
        "insert into public.historias (paciente_id) values ($1) returning numero", [paciente],
      );
      expect(h.numero).toBe(1);
      const c = await uno<{ detalle: string; usuario_nombre: string }>(
        "select detalle, usuario_nombre from public.historia_cambios where paciente_id = $1", [paciente],
      );
      expect(c).toEqual({ detalle: "abrió la historia clínica.", usuario_nombre: "Marcela Salazar" });
    });
  });

  it("guarda la versión anterior de una sección y junta el autoguardado en un solo renglón", async () => {
    await como(db, staff, async () => {
      await db.query("update public.historias set motivo_consulta = 'Primera versión' where paciente_id = $1", [paciente]);
      await db.query("update public.historias set motivo_consulta = 'Primera versión, ampliada' where paciente_id = $1", [paciente]);
      const filas = (await db.query<{ detalle: string; anterior: string | null }>(
        "select detalle, anterior from public.historia_cambios where paciente_id = $1 and campo = 'motivo_consulta'",
        [paciente],
      )).rows;
      expect(filas).toEqual([{ detalle: "editó «Motivo de consulta».", anterior: null }]);
    });
  });

  it("el listado marca la historia como incompleta mientras falten secciones", async () => {
    await como(db, staff, async () => {
      const fila = await uno<{ estado: string; secciones_vacias: number }>(
        "select estado, secciones_vacias from public.historias_listado where paciente_id = $1", [paciente],
      );
      expect(fila).toEqual({ estado: "incompleta", secciones_vacias: 5 });
    });
  });

  it("no deja firmar una nota vacía; al firmarla la sella y registra la sesión en la ficha", async () => {
    await como(db, staff, async () => {
      const id = (await uno<{ id: string }>(
        "select public.crear_nota($1, '2026-11-09') as id", [paciente],
      )).id;
      const nota = await uno<{ numero: number; modalidad: string; duracion_min: number }>(
        "select numero, modalidad, duracion_min from public.historia_notas where id = $1", [id],
      );
      expect(nota).toEqual({ numero: 1, modalidad: "online", duracion_min: 60 });

      await expect(db.query("select public.firmar_nota($1, 'pagada')", [id])).rejects.toThrow(/está vacía/);

      await db.query(
        `update public.historia_notas set campos = '{"desarrollo": "Se revisa la tarea."}' where id = $1`, [id],
      );
      await db.query("select public.firmar_nota($1, 'sin_pagar')", [id]);

      const firmada = await uno<{ estado: string; firmada_nombre: string; firmada_por: string; con_sello: boolean }>(
        `select estado, firmada_nombre, firmada_por, firmada_el is not null as con_sello
           from public.historia_notas where id = $1`, [id],
      );
      expect(firmada).toEqual({ estado: "firmada", firmada_nombre: "Marcela Salazar", firmada_por: staff, con_sello: true });

      const sesion = await uno<{ numero: number; fecha: string; asistencia: string; pago: string }>(
        `select s.numero, s.fecha::text as fecha, s.asistencia, s.pago
           from public.sesiones s join public.historia_notas n on n.sesion_id = s.id where n.id = $1`, [id],
      );
      expect(sesion).toEqual({ numero: 1, fecha: "2026-11-09", asistencia: "realizada", pago: "sin_pagar" });
    });
  });

  it("una nota firmada no se edita ni se borra: solo admite adendas", async () => {
    await como(db, staff, async () => {
      const id = (await uno<{ id: string }>(
        "select id from public.historia_notas where paciente_id = $1 and numero = 1", [paciente],
      )).id;
      await expect(
        db.query(`update public.historia_notas set campos = '{"desarrollo": "Otro texto"}' where id = $1`, [id]),
      ).rejects.toThrow(/no se puede modificar/);
      await expect(
        db.query("update public.historia_notas set estado = 'borrador' where id = $1", [id]),
      ).rejects.toThrow(/no se puede modificar/);
      await expect(db.query("delete from public.historia_notas where id = $1", [id])).rejects.toThrow(/no se puede eliminar/);

      await db.query("insert into public.historia_adendas (nota_id, texto) values ($1, 'Se aclara la tarea.')", [id]);
      const a = await uno<{ autor_nombre: string }>("select autor_nombre from public.historia_adendas where nota_id = $1", [id]);
      expect(a.autor_nombre).toBe("Marcela Salazar");
      await expect(db.query("delete from public.historia_adendas where nota_id = $1", [id])).rejects.toThrow(/permission denied/);
    });
  });

  it("si se borra la sesión de la ficha, la nota firmada queda, sin el enlace", async () => {
    await como(db, staff, async () => {
      await db.query("delete from public.sesiones where paciente_id = $1", [paciente]);
      const n = await uno<{ estado: string; sesion_id: string | null }>(
        "select estado, sesion_id from public.historia_notas where paciente_id = $1 and numero = 1", [paciente],
      );
      expect(n).toEqual({ estado: "firmada", sesion_id: null });
    });
  });

  it("un borrador sí se puede eliminar, y las adendas no aplican a borradores", async () => {
    await como(db, staff, async () => {
      const id = (await uno<{ id: string }>("select public.crear_nota($1, '2026-11-16') as id", [paciente])).id;
      await expect(
        db.query("insert into public.historia_adendas (nota_id, texto) values ($1, 'x')", [id]),
      ).rejects.toThrow(/notas firmadas/);
      await db.query("delete from public.historia_notas where id = $1", [id]);
      const n = await uno<{ n: number }>("select count(*)::int as n from public.historia_notas where paciente_id = $1", [paciente]);
      expect(n.n).toBe(1);
    });
  });

  it("nadie del equipo puede borrar la historia, ni el paciente que la tiene, ni tocar el historial", async () => {
    await como(db, staff, async () => {
      await expect(db.query("delete from public.historias where paciente_id = $1", [paciente])).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.pacientes where id = $1", [paciente])).rejects.toThrow(/violates/);
      await expect(db.query("delete from public.historia_cambios")).rejects.toThrow(/permission denied/);
      await expect(
        db.query("update public.historia_cambios set detalle = 'x' where paciente_id = $1", [paciente]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("el historial cuenta lo que pasó, en orden", async () => {
    await como(db, staff, async () => {
      await db.query("insert into public.historia_objetivos (paciente_id, nombre) values ($1, 'Proyecto de vida')", [paciente]);
      await db.query("update public.historia_objetivos set estado = 'en_curso' where paciente_id = $1", [paciente]);
      await db.query("select public.registrar_exportacion($1, 'la historia completa')", [paciente]);
      const detalles = (await db.query<{ detalle: string }>(
        "select detalle from public.historia_cambios where paciente_id = $1 order by id", [paciente],
      )).rows.map((r) => r.detalle);
      expect(detalles).toEqual([
        "abrió la historia clínica.",
        "editó «Motivo de consulta».",
        "creó la nota de la sesión 1 (borrador).",
        "firmó la nota de la sesión 1. Quedó bloqueada.",
        "agregó una adenda a la nota de la sesión 1.",
        "creó la nota de la sesión 2 (borrador).",
        "eliminó el borrador de la sesión 2.",
        "agregó al plan de trabajo el objetivo «Proyecto de vida».",
        "marcó el objetivo «Proyecto de vida» como en curso.",
        "exportó la historia completa en PDF.",
      ]);
    });
  });

  it("una historia importada queda por revisar; al confirmarla, sus notas se firman", async () => {
    const otro = (await uno<{ id: string }>(
      "insert into public.pacientes (nombre_completo) values ('Beto Ejemplo') returning id",
    )).id;
    // La importación corre con la llave de servicio: sin usuario.
    await db.query(
      `insert into public.historias (paciente_id, origen, archivo_origen, motivo_consulta, avisos)
       values ($1, 'word', 'Beto Ejemplo.docx', 'Ansiedad', '["La sesión 2 no tiene fecha."]')`, [otro],
    );
    await db.query(
      `insert into public.historia_notas (paciente_id, numero, fecha, campos, origen, encabezado_origen)
       values ($1, 1, '2026-02-26', '{"desarrollo": "Se revisa motivo de consulta"}', 'word', 'SESIÓN 1'),
              ($1, 2, null, '{}', 'word', 'SESIÓN 2')`, [otro],
    );
    await como(db, staff, async () => {
      const antes = await uno<{ estado: string; notas_borrador: number; avisos_total: number }>(
        "select estado, notas_borrador, avisos_total from public.historias_listado where paciente_id = $1", [otro],
      );
      expect(antes).toEqual({ estado: "por_revisar", notas_borrador: 0, avisos_total: 1 });

      await db.query("update public.historia_notas set fecha = '2026-03-12' where paciente_id = $1 and numero = 2", [otro]);
      await db.query("select public.confirmar_importacion($1)", [otro]);

      const notas = (await db.query<{ estado: string; firmada_nombre: string }>(
        "select estado, firmada_nombre from public.historia_notas where paciente_id = $1 order by numero", [otro],
      )).rows;
      expect(notas).toEqual([
        { estado: "firmada", firmada_nombre: "Marcela Salazar" },
        { estado: "firmada", firmada_nombre: "Marcela Salazar" },
      ]);
      const despues = await uno<{ estado: string }>(
        "select estado from public.historias_listado where paciente_id = $1", [otro],
      );
      expect(despues.estado).toBe("incompleta");
      await expect(db.query("select public.confirmar_importacion($1)", [otro])).rejects.toThrow(/no está pendiente/);
    });
    const cambios = (await db.query<{ usuario_nombre: string; detalle: string }>(
      "select usuario_nombre, detalle from public.historia_cambios where paciente_id = $1 order by id", [otro],
    )).rows;
    expect(cambios).toEqual([
      { usuario_nombre: "Importación", detalle: "importó la historia desde el archivo de Word «Beto Ejemplo.docx»." },
      { usuario_nombre: "Marcela Salazar", detalle: "confirmó la revisión de la historia importada. Sus notas quedaron firmadas." },
    ]);
  });

  it("una cuenta sin perfil no ve ni escribe nada de las historias", async () => {
    await como(db, intruso, async () => {
      for (const tabla of ["historias", "historia_notas", "historia_adendas", "historia_objetivos", "historia_cambios", "historias_listado"]) {
        const r = await uno<{ n: number }>(`select count(*)::int as n from public.${tabla}`);
        expect(r.n, tabla).toBe(0);
      }
      await expect(db.query("select public.crear_nota($1, '2026-11-20')", [paciente])).rejects.toThrow(/no tiene historia/);
      await expect(
        db.query("select public.registrar_exportacion($1, 'la historia completa')", [paciente]),
      ).rejects.toThrow(/Sin acceso/);
    });
  });
});
