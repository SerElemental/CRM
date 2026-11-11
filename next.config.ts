import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
