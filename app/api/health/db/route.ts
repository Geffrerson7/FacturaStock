import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";

/**
 * Endpoint de verificación de la conexión a PostgreSQL.
 *
 * GET /api/health/db
 * (Con `cacheComponents` habilitado los Route Handlers son dinámicos por
 * defecto, por eso no se usa `export const dynamic`.)
 */
export async function GET() {
  try {
    const [info] = await prisma.$queryRaw<
      { database: string; version: string }[]
    >`SELECT current_database() AS database, version() AS version`;

    // Consultas tipadas con el cliente generado.
    const customers = await prisma.customer.count();

    return NextResponse.json({
      status: "ok",
      database: info?.database,
      version: info?.version,
      conteos: { customers },
    });
  } catch (error) {
    console.error("[db-health] Error conectando a PostgreSQL:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Error desconocido de base de datos",
      },
      { status: 503 },
    );
  }
}
