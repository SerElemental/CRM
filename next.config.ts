import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El PDF de las facturas lee del disco las tipografías y el logo. En el
  // despliegue hay que decirle a Next que incluya esos archivos con las rutas
  // que los usan, porque no los ve como dependencias del código.
  outputFileTracingIncludes: {
    "/facturas/**": [
      "./node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-*-normal.woff",
      "./node_modules/@fontsource/rufina/files/rufina-latin-*-normal.woff",
      "./node_modules/@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff",
      "./public/marca/logo-ser-elemental.png",
    ],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  // Todo el CRM vive detrás de la sesión (cookies en cada pantalla), así que no
  // se usa el modelo de componentes en caché: cada página se renderiza por petición.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
