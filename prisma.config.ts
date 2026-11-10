import "dotenv/config";

import path from "node:path";

import { defineConfig } from "prisma/config";

/**
 * Configuración de la CLI de Prisma (Prisma ORM 7).
 *
 * Nota: en Prisma 7 el archivo `.env` NO se carga automáticamente, por eso
 * importamos `dotenv/config` arriba. Usamos `process.env` (y no el helper
 * `env()`) para que comandos como `prisma generate` funcionen incluso en CI
 * sin tener `DATABASE_URL` definida.
 *
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
