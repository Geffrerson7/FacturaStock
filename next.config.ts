import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // La plantilla del correo de bienvenida se lee con fs en tiempo de ejecución;
  // el trazado de archivos no la detecta solo.
  outputFileTracingIncludes: {
    "/api/auth/**": ["./email/**/*.html"],
  },
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
