/**
 * Plantilla PDF de los documentos de cobro de Ser Elemental: una sola para la
 * factura de EE. UU. (inglés, USD) y la cuenta de cobro de Colombia (español,
 * COP). Cambian los datos y los textos; el diseño es el mismo.
 *
 * Marca (tomada de ser-elemental.com): tipografías Josefin Sans y Rufina, rosa
 * #e9cabe, arena #d3af95, tinta casi negra.
 */
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { pesosEnLetras } from "./letras";
import { TEXTOS, dinero, fechaCorta, fechaLarga, totalFactura, type DatosFactura } from "./tipos";

// ───────────────────────── Tipografías ─────────────────────────
const fuente = (paquete: string, archivo: string) =>
  path.join(process.cwd(), "node_modules", "@fontsource", paquete, "files", archivo);

Font.register({
  family: "Josefin Sans",
  fonts: [
    { src: fuente("josefin-sans", "josefin-sans-latin-300-normal.woff"), fontWeight: 300 },
    { src: fuente("josefin-sans", "josefin-sans-latin-400-normal.woff"), fontWeight: 400 },
    { src: fuente("josefin-sans", "josefin-sans-latin-600-normal.woff"), fontWeight: 600 },
    { src: fuente("josefin-sans", "josefin-sans-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Rufina",
  fonts: [
    { src: fuente("rufina", "rufina-latin-400-normal.woff"), fontWeight: 400 },
    { src: fuente("rufina", "rufina-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Firma",
  src: fuente("mrs-saint-delafield", "mrs-saint-delafield-latin-400-normal.woff"),
});
// Sin guiones de corte: un nombre o un correo no se parten a mitad de palabra.
Font.registerHyphenationCallback((palabra) => [palabra]);

// ───────────────────────── Estilos ─────────────────────────
const C = {
  tinta: "#1f1a22",
  gris: "#6b6570",
  rosa: "#e9cabe",
  rosaClaro: "#f8ede8",
  arena: "#d3af95",
  terracota: "#b07a5c",
  papel: "#ffffff",
  linea: "#ead9cf",
};
const MARGEN = 48;

const s = StyleSheet.create({
  pagina: {
    backgroundColor: C.papel, color: C.tinta, fontFamily: "Josefin Sans", fontWeight: 300,
    fontSize: 10, lineHeight: 1.45, paddingBottom: 70,
  },
  franja: { height: 10, backgroundColor: C.rosa },
  cuerpo: { paddingHorizontal: MARGEN },

  cabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 28 },
  logo: { width: 196, height: 43.4 },
  lema: { marginTop: 8, fontSize: 7.5, fontWeight: 600, letterSpacing: 2.2, color: C.gris, textTransform: "uppercase" },
  documento: { alignItems: "flex-end" },
  tipoDocumento: { fontSize: 9, fontWeight: 700, letterSpacing: 3, color: C.terracota, textTransform: "uppercase" },
  // Las cifras van en Josefin Sans: en Rufina el «1» es de estilo antiguo y se lee como una «I».
  numero: { fontWeight: 700, fontSize: 19, letterSpacing: 0.8, marginTop: 5, lineHeight: 1.2 },
  fecha: { marginTop: 3, fontSize: 9.5, color: C.gris },

  separador: { height: 1, backgroundColor: C.linea, marginTop: 18 },

  partes: { flexDirection: "row", marginTop: 18, gap: 28 },
  parte: { flex: 1 },
  etiqueta: { fontSize: 7.5, fontWeight: 700, letterSpacing: 2.2, color: C.terracota, textTransform: "uppercase", marginBottom: 6 },
  nombreParte: { fontFamily: "Rufina", fontWeight: 700, fontSize: 13, lineHeight: 1.25, marginBottom: 3 },
  lineaParte: { fontSize: 9.5, color: C.gris },

  tabla: { marginTop: 22 },
  filaCabecera: {
    flexDirection: "row", backgroundColor: C.rosaClaro, paddingVertical: 8, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: C.arena,
  },
  celdaCabecera: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: C.tinta },
  fila: {
    flexDirection: "row", paddingVertical: 8, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: C.linea, alignItems: "flex-start",
  },
  colDescripcion: { flex: 1, paddingRight: 10 },
  colFecha: { width: 72 },
  colCantidad: { width: 40, textAlign: "center" },
  colUnitario: { width: 104, textAlign: "right" },
  colSubtotal: { width: 84, textAlign: "right" },
  descripcion: { fontWeight: 400 },
  numeros: { fontWeight: 400 },

  totales: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  cajaTotal: { width: 250, backgroundColor: C.rosaClaro, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 3 },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  etiquetaTotal: { fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" },
  valorTotal: { fontWeight: 700, fontSize: 20, lineHeight: 1.1 },
  moneda: { fontWeight: 600, fontSize: 9, color: C.gris },
  enLetras: { marginTop: 8, fontSize: 9.5, color: C.gris },
  enLetrasValor: { color: C.tinta, fontWeight: 400 },

  cierre: { flexDirection: "row", marginTop: 22, gap: 24 },
  pago: { flex: 1.2 },
  filaPago: { flexDirection: "row", marginBottom: 2 },
  pagoEtiqueta: { width: 108, fontSize: 9.5, color: C.gris },
  pagoValor: { flex: 1, fontSize: 9.5, fontWeight: 400 },
  firma: { flex: 1, alignItems: "flex-end" },
  gracias: { fontSize: 8, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: C.terracota },
  rubrica: { fontFamily: "Firma", fontSize: 27, lineHeight: 1.1, marginTop: 10, textAlign: "right" },
  lineaFirma: { height: 1, width: 200, backgroundColor: C.arena, marginTop: 1 },
  firmante: { marginTop: 6, fontSize: 9.5, fontWeight: 600, textAlign: "right" },
  firmanteDetalle: { fontSize: 9, color: C.gris, textAlign: "right" },

  notas: { marginTop: 16 },
  notasTexto: { fontSize: 9.5, color: C.gris },

  pie: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pieTexto: {
    marginHorizontal: MARGEN, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: C.linea,
    flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: C.gris,
  },
  pieFranja: { height: 10, backgroundColor: C.rosa },
  sello: {
    position: "absolute", top: 330, left: 0, right: 0, textAlign: "center",
    fontSize: 78, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase",
    color: C.terracota, opacity: 0.16, transform: "rotate(-24deg)",
  },
});

const logoPorDefecto = () => path.join(process.cwd(), "public", "marca", "logo-ser-elemental.png");

export function FacturaPDF({ datos, logo = logoPorDefecto() }: { datos: DatosFactura; logo?: string }) {
  const { emisor, cliente, items } = datos;
  const t = TEXTOS[emisor.idioma];
  const total = totalFactura(items);
  const conFecha = items.some((i) => i.fecha);

  const lineasCliente = [cliente.identificacion, cliente.direccion, cliente.email, cliente.telefono].filter(Boolean);
  const lineasEmisor = [
    emisor.identificacion,
    [emisor.direccion, emisor.ciudad].filter(Boolean).join(emisor.direccion ? " · " : ""),
    emisor.telefonos.join(" · ") || null,
    emisor.email,
  ].filter(Boolean);

  return (
    <Document
      title={`${emisor.nombreDocumento} ${datos.numero}`}
      author={emisor.razonSocial}
      subject={`${emisor.nombreDocumento} ${datos.numero} · ${cliente.nombre}`}
      language={emisor.idioma}
    >
      <Page size="LETTER" style={s.pagina}>
        <View style={s.franja} fixed />

        <View style={s.cuerpo}>
          <View style={s.cabecera}>
            <View>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> de react-pdf no es una <img> de HTML */}
              <Image src={logo} style={s.logo} />
              <Text style={s.lema}>{emisor.lema}</Text>
            </View>
            <View style={s.documento}>
              <Text style={s.tipoDocumento}>{emisor.nombreDocumento}</Text>
              <Text style={s.numero}>{datos.numero}</Text>
              <Text style={s.fecha}>
                {t.fecha}: {fechaLarga(datos.fecha, emisor.idioma)}
              </Text>
            </View>
          </View>

          <View style={s.separador} />

          <View style={s.partes}>
            <View style={s.parte}>
              <Text style={s.etiqueta}>{t.para}</Text>
              <Text style={s.nombreParte}>{cliente.nombre}</Text>
              {lineasCliente.map((l) => <Text key={l} style={s.lineaParte}>{l}</Text>)}
            </View>
            <View style={s.parte}>
              <Text style={s.etiqueta}>{t.de}</Text>
              <Text style={s.nombreParte}>{emisor.razonSocial}</Text>
              {lineasEmisor.map((l) => <Text key={l} style={s.lineaParte}>{l}</Text>)}
            </View>
          </View>

          <View style={s.tabla}>
            <View style={s.filaCabecera} fixed>
              <Text style={[s.celdaCabecera, s.colDescripcion]}>{t.descripcion}</Text>
              {conFecha && <Text style={[s.celdaCabecera, s.colFecha]}>{t.fechaSesion}</Text>}
              <Text style={[s.celdaCabecera, s.colCantidad]}>{t.cantidad}</Text>
              <Text style={[s.celdaCabecera, s.colUnitario]}>{t.unitario}</Text>
              <Text style={[s.celdaCabecera, s.colSubtotal]}>{t.subtotal}</Text>
            </View>
            {items.map((item, i) => (
              <View key={i} style={s.fila} wrap={false}>
                <Text style={[s.descripcion, s.colDescripcion]}>{item.descripcion}</Text>
                {conFecha && (
                  <Text style={s.colFecha}>{item.fecha ? fechaCorta(item.fecha, emisor.idioma) : ""}</Text>
                )}
                <Text style={[s.numeros, s.colCantidad]}>{item.cantidad}</Text>
                <Text style={[s.numeros, s.colUnitario]}>{dinero(item.valorUnitario, emisor.moneda)}</Text>
                <Text style={[s.numeros, s.colSubtotal]}>
                  {dinero(item.cantidad * item.valorUnitario, emisor.moneda)}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.totales} wrap={false}>
            <View style={s.cajaTotal}>
              <View style={s.filaTotal}>
                <Text style={s.etiquetaTotal}>{t.total}</Text>
                <Text style={s.valorTotal}>
                  {dinero(total, emisor.moneda)} <Text style={s.moneda}>{emisor.moneda}</Text>
                </Text>
              </View>
            </View>
          </View>
          {emisor.moneda === "COP" && (
            <Text style={s.enLetras}>
              {t.enLetras}: <Text style={s.enLetrasValor}>{pesosEnLetras(total)}</Text>
            </Text>
          )}

          {datos.notas ? (
            <View style={s.notas} wrap={false}>
              <Text style={s.etiqueta}>{t.notas}</Text>
              <Text style={s.notasTexto}>{datos.notas}</Text>
            </View>
          ) : null}

          <View style={s.cierre} wrap={false}>
            <View style={s.pago}>
              <Text style={s.etiqueta}>{t.pago}</Text>
              {emisor.pago.map(([etiqueta, valor]) => (
                <View key={etiqueta} style={s.filaPago}>
                  <Text style={s.pagoEtiqueta}>{etiqueta}</Text>
                  <Text style={s.pagoValor}>{valor}</Text>
                </View>
              ))}
            </View>
            <View style={s.firma}>
              <Text style={s.gracias}>{t.gracias}</Text>
              <Text style={s.rubrica}>{emisor.firma}</Text>
              <View style={s.lineaFirma} />
              <Text style={s.firmante}>{emisor.representante}</Text>
              <Text style={s.firmanteDetalle}>{emisor.documentoFirmante ?? emisor.razonSocial}</Text>
            </View>
          </View>
        </View>

        {datos.sello ? <Text style={s.sello} fixed>{t[datos.sello]}</Text> : null}

        <View style={s.pie} fixed>
          <View style={s.pieTexto}>
            <Text>{emisor.ciudad}</Text>
            <Text>{emisor.web.replace(/^https?:\/\//, "")}</Text>
            <Text>{emisor.email}</Text>
          </View>
          <View style={s.pieFranja} />
        </View>
      </Page>
    </Document>
  );
}

/** El PDF como bytes, listo para descargar o guardar. */
export function generarFacturaPDF(datos: DatosFactura, logo?: string): Promise<Buffer> {
  return renderToBuffer(<FacturaPDF datos={datos} logo={logo} />);
}
