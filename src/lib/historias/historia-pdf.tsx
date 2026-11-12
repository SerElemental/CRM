/**
 * PDF de la historia clínica: el «Registro de atención psicológica» con la
 * misma marca de las facturas (Josefin Sans, Rufina, rosa y arena). Sale sin
 * clave: es un PDF corriente.
 */
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { NotaFormato, ObjetivoEstado } from "@/lib/database.types";
import { camposEscritos } from "./formatos";
import { OBJETIVO_LABEL, SECCIONES, type CampoSeccion } from "./index";

// Mismas tipografías que las facturas (ver `lib/facturas/fuentes/LEEME.md`).
const fuente = (archivo: string) => path.join(process.cwd(), "src", "lib", "facturas", "fuentes", archivo);
Font.register({
  family: "Josefin Sans",
  fonts: [
    { src: fuente("josefin-sans-300.ttf"), fontWeight: 300 },
    { src: fuente("josefin-sans-400.ttf"), fontWeight: 400 },
    { src: fuente("josefin-sans-600.ttf"), fontWeight: 600 },
    { src: fuente("josefin-sans-700.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Rufina",
  fonts: [
    { src: fuente("rufina-400.ttf"), fontWeight: 400 },
    { src: fuente("rufina-700.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((palabra) => [palabra]);

const C = {
  tinta: "#1f1a22", gris: "#6b6570", rosa: "#e9cabe", rosaClaro: "#f8ede8",
  arena: "#d3af95", terracota: "#b07a5c", papel: "#ffffff", linea: "#ead9cf",
};
const MARGEN = 48;

const s = StyleSheet.create({
  pagina: {
    backgroundColor: C.papel, color: C.tinta, fontFamily: "Josefin Sans", fontWeight: 300,
    fontSize: 10, paddingTop: 34, paddingBottom: 62, paddingHorizontal: MARGEN,
  },
  // OJO: el interlineado va en cada estilo de texto, no en la página. Con `lineHeight`
  // en la página, react-pdf 4.9 deja en blanco los textos dinámicos (el número de página).
  franja: { position: "absolute", top: 0, left: 0, right: 0, height: 10, backgroundColor: C.rosa },

  cabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 },
  logo: { width: 176, height: 39 },
  documento: { alignItems: "flex-end" },
  tipoDocumento: { fontSize: 8.5, fontWeight: 700, letterSpacing: 3, color: C.terracota, textTransform: "uppercase" },
  numero: { fontWeight: 700, fontSize: 17, letterSpacing: 0.8, marginTop: 4, lineHeight: 1.2 },
  exportada: { marginTop: 2, fontSize: 9, lineHeight: 1.5, color: C.gris },
  separador: { height: 1, backgroundColor: C.linea, marginTop: 14 },

  titulo: { fontFamily: "Rufina", fontWeight: 700, fontSize: 17, lineHeight: 1.25, marginTop: 16 },
  paciente: { fontSize: 10.5, lineHeight: 1.5, color: C.gris, marginTop: 2 },

  ficha: {
    marginTop: 12, backgroundColor: C.rosaClaro, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: "row", flexWrap: "wrap",
  },
  dato: { width: "50%", flexDirection: "row", paddingVertical: 1.5, paddingRight: 10 },
  datoEtiqueta: { width: 104, fontSize: 9, lineHeight: 1.5, color: C.gris },
  datoValor: { flex: 1, fontSize: 9.5, lineHeight: 1.5, fontWeight: 400 },

  parte: {
    marginTop: 22, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.arena,
    fontSize: 8.5, fontWeight: 700, letterSpacing: 2.6, color: C.terracota, textTransform: "uppercase",
  },
  seccion: { marginTop: 13 },
  seccionTitulo: { fontFamily: "Rufina", fontWeight: 700, fontSize: 11.5, lineHeight: 1.3, marginBottom: 3 },
  subtitulo: { fontSize: 9.5, lineHeight: 1.5, fontWeight: 700, marginTop: 7, marginBottom: 1 },
  texto: { fontSize: 10, lineHeight: 1.5, fontWeight: 300 },
  vacio: { fontSize: 9.5, lineHeight: 1.5, color: C.gris },
  imagen: { marginTop: 8, maxHeight: 300, objectFit: "contain", alignSelf: "flex-start" },

  objetivo: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.linea },
  objetivoNombre: { flex: 1, lineHeight: 1.5, fontWeight: 400, paddingRight: 10 },
  objetivoEstado: { width: 78, fontSize: 9, lineHeight: 1.5, color: C.gris },
  objetivoSesiones: { width: 150, fontSize: 9, lineHeight: 1.5, color: C.gris, textAlign: "right" },

  nota: { marginTop: 14 },
  notaCabecera: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    backgroundColor: C.rosaClaro, borderTopWidth: 1, borderTopColor: C.arena, paddingVertical: 6, paddingHorizontal: 10,
  },
  notaTitulo: { fontFamily: "Rufina", fontWeight: 700, fontSize: 11.5, lineHeight: 1.25 },
  notaMeta: { fontSize: 9, lineHeight: 1.5, color: C.gris },
  campo: { flexDirection: "row", marginTop: 6, paddingHorizontal: 10 },
  campoEtiqueta: { width: 104, fontSize: 8, fontWeight: 700, letterSpacing: 1.2, lineHeight: 1.5, color: C.terracota, textTransform: "uppercase", paddingTop: 1.5 },
  campoTexto: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  adenda: { marginTop: 7, marginHorizontal: 10, paddingVertical: 6, paddingHorizontal: 9, borderLeftWidth: 2, borderLeftColor: C.arena, backgroundColor: "#fbf6f3" },
  adendaTitulo: { fontSize: 8.5, lineHeight: 1.5, fontWeight: 700, marginBottom: 1 },
  firma: { marginTop: 6, paddingHorizontal: 10, fontSize: 8.5, lineHeight: 1.5, color: C.gris },
  borrador: { marginTop: 6, paddingHorizontal: 10, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, color: C.terracota, textTransform: "uppercase" },

  pieLinea: { position: "absolute", left: MARGEN, right: MARGEN, bottom: 42, height: 1, backgroundColor: C.linea },
  pieIzquierda: { position: "absolute", left: MARGEN, bottom: 21, fontSize: 8.5, color: C.gris },
  pieDerecha: { position: "absolute", left: MARGEN, right: MARGEN, bottom: 21, fontSize: 8.5, color: C.gris, textAlign: "right" },
  pieFranja: { position: "absolute", left: 0, right: 0, bottom: 0, height: 10, backgroundColor: C.rosa },
});

export type NotaPDF = {
  numero: number;
  /** «9 nov 2026», o el texto original si no hay fecha exacta. */
  fecha: string;
  /** «60 min · Online». */
  detalle: string;
  formato: NotaFormato;
  campos: Record<string, string>;
  objetivos: string[];
  /** «Firmada por Marcela Salazar · 9 nov 2026, 5:04 p. m.», o null si es borrador. */
  firma: string | null;
  importada: boolean;
  adendas: { encabezado: string; texto: string }[];
};

export type DatosHistoriaPDF = {
  numero: string;
  nombre: string;
  profesional: string;
  /** «11 de noviembre de 2026»… ya formateada. */
  exportada: string;
  identificacion: { etiqueta: string; valor: string }[];
  /** Con `null` no se incluye la valoración inicial ni el plan (exportación de un rango de sesiones). */
  valoracion: {
    secciones: Partial<Record<CampoSeccion, string | null>>;
    objetivos: { nombre: string; estado: ObjetivoEstado; sesiones: string }[];
    imagenes: { nombre: string; data: Buffer; format: "png" | "jpg" }[];
  } | null;
  /** Con `null` no se incluye la evolución (exportación de solo la valoración). */
  notas: NotaPDF[] | null;
  /** «Sesiones del 1 sep 2026 al 9 nov 2026», cuando no van todas. */
  rango?: string;
};

const logoPorDefecto = () => path.join(process.cwd(), "public", "marca", "logo-ser-elemental.png");

function Seccion({ titulo, texto, children }: { titulo: string; texto?: string | null; children?: React.ReactNode }) {
  return (
    <View style={s.seccion}>
      <Text style={s.seccionTitulo} minPresenceAhead={30}>{titulo}</Text>
      {texto?.trim() ? <Text style={s.texto}>{texto.trim()}</Text> : <Text style={s.vacio}>Sin diligenciar.</Text>}
      {children}
    </View>
  );
}

export function HistoriaPDF({ datos, logo = logoPorDefecto() }: { datos: DatosHistoriaPDF; logo?: string }) {
  const v = datos.valoracion;
  return (
    <Document
      title={`Historia clínica ${datos.numero}`}
      author={datos.profesional}
      subject={`Registro de atención psicológica · ${datos.nombre}`}
      language="es"
    >
      <Page size="LETTER" style={s.pagina}>
        <View style={s.franja} fixed />
        {/* Pie de cada hoja: de quién es la historia y qué folio es. */}
        <View style={s.pieLinea} fixed />
        <Text style={s.pieIzquierda} fixed>{datos.nombre} · {datos.numero} · {datos.profesional}</Text>
        <Text style={s.pieDerecha} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        <View style={s.pieFranja} fixed />

        <View style={s.cabecera}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> de react-pdf no es una <img> de HTML */}
          <Image src={logo} style={s.logo} />
          <View style={s.documento}>
            <Text style={s.tipoDocumento}>Historia clínica</Text>
            <Text style={s.numero}>{datos.numero}</Text>
            <Text style={s.exportada}>Exportada el {datos.exportada}</Text>
          </View>
        </View>
        <View style={s.separador} />

        <Text style={s.titulo}>Registro de atención psicológica</Text>
        <Text style={s.paciente}>{datos.nombre}{datos.rango ? ` · ${datos.rango}` : ""}</Text>

        <View style={s.ficha}>
          {datos.identificacion.map((d) => (
            <View key={d.etiqueta} style={s.dato}>
              <Text style={s.datoEtiqueta}>{d.etiqueta}</Text>
              <Text style={s.datoValor}>{d.valor}</Text>
            </View>
          ))}
        </View>

        {v && (
          <>
            <Text style={s.parte} minPresenceAhead={60}>Valoración inicial</Text>
            {SECCIONES.map((sec) => (
              <Seccion key={sec.campo} titulo={`${sec.n}. ${sec.titulo}`} texto={v.secciones[sec.campo]}>
                {sec.subs?.map((b) =>
                  v.secciones[b.campo]?.trim() ? (
                    <View key={b.campo}>
                      <Text style={s.subtitulo}>{b.titulo}</Text>
                      <Text style={s.texto}>{v.secciones[b.campo]!.trim()}</Text>
                    </View>
                  ) : null,
                )}
                {sec.genograma && v.imagenes.map((img) => (
                  <View key={img.nombre} wrap={false}>
                    <Text style={s.subtitulo}>{img.nombre}</Text>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> de react-pdf no es una <img> de HTML */}
                    <Image src={{ data: img.data, format: img.format }} style={s.imagen} />
                  </View>
                ))}
              </Seccion>
            ))}

            <Text style={s.parte} minPresenceAhead={60}>Concepto y plan de trabajo</Text>
            <Seccion titulo="Concepto general" texto={v.secciones.concepto_general} />
            <View style={s.seccion}>
              <Text style={s.seccionTitulo} minPresenceAhead={30}>Plan de trabajo</Text>
              {v.objetivos.length === 0 ? (
                <Text style={s.vacio}>Sin objetivos registrados.</Text>
              ) : (
                v.objetivos.map((o) => (
                  <View key={o.nombre} style={s.objetivo} wrap={false}>
                    <Text style={s.objetivoNombre}>{o.nombre}</Text>
                    <Text style={s.objetivoEstado}>{OBJETIVO_LABEL[o.estado]}</Text>
                    <Text style={s.objetivoSesiones}>{o.sesiones}</Text>
                  </View>
                ))
              )}
            </View>
            {v.secciones.herramientas_apoyo?.trim() ? (
              <Seccion titulo="Herramientas de apoyo" texto={v.secciones.herramientas_apoyo} />
            ) : null}
          </>
        )}

        {datos.notas && (
          <>
            <Text style={s.parte} minPresenceAhead={80}>
              Evolución · {datos.notas.length} {datos.notas.length === 1 ? "sesión" : "sesiones"}
            </Text>
            {datos.notas.length === 0 && <Text style={[s.vacio, { marginTop: 10 }]}>No hay notas de sesión en este rango.</Text>}
            {datos.notas.map((n) => (
              <View key={n.numero} style={s.nota}>
                <View style={s.notaCabecera} minPresenceAhead={40}>
                  <Text style={s.notaTitulo}>Sesión {n.numero}</Text>
                  <Text style={s.notaMeta}>{[n.fecha, n.detalle].filter(Boolean).join(" · ")}</Text>
                </View>
                {camposEscritos(n).map((c) => (
                  <View key={c.clave} style={s.campo}>
                    <Text style={s.campoEtiqueta}>{c.label}</Text>
                    <Text style={s.campoTexto}>{c.texto}</Text>
                  </View>
                ))}
                {n.objetivos.length > 0 && (
                  <View style={s.campo}>
                    <Text style={s.campoEtiqueta}>Se trabajó</Text>
                    <Text style={s.campoTexto}>{n.objetivos.join(" · ")}</Text>
                  </View>
                )}
                {n.adendas.map((a, i) => (
                  <View key={i} style={s.adenda}>
                    <Text style={s.adendaTitulo}>{a.encabezado}</Text>
                    <Text style={s.texto}>{a.texto}</Text>
                  </View>
                ))}
                {n.firma
                  ? <Text style={s.firma}>{n.firma}{n.importada ? " · Importada del registro en Word" : ""}</Text>
                  : <Text style={s.borrador}>Borrador sin firmar</Text>}
              </View>
            ))}
          </>
        )}

      </Page>
    </Document>
  );
}

export function generarHistoriaPDF(datos: DatosHistoriaPDF, logo?: string): Promise<Buffer> {
  return renderToBuffer(<HistoriaPDF datos={datos} logo={logo} />);
}
