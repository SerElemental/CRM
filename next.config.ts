import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El PDF de las facturas lee del disco las tipografías y el logo. En el
  // despliegue hay que decirle a Next que incluya esos archivos con las rutas
  // que los usan, porque no los ve como dependencias del código.
  outputFileTracingIncludes: {
    "/facturas/**": [
      "./src/lib/facturas/fuentes/*.ttf",
      "./public/marca/logo-ser-elemental.png",
    ],
    // El PDF de la historia clínica usa las mismas tipografías y el mismo logo.
    "/historias/**": [
      "./src/lib/facturas/fuentes/*.ttf",
      "./public/marca/logo-ser-elemental.png",
    ],
  },
  // Los adjuntos de la historia (hasta 4 MB) viajan en una Server Action.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
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
