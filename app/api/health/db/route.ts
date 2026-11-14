import { connection, NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";

/**
 * Endpoint de verificación de la conexión a PostgreSQL.
 *
 * GET /api/health/db
 *
 * Es público, así que solo responde `ok` o `error`: la versión del servidor y
 * el detalle del fallo quedan en los logs.
 * `connection()` evita que el build intente prerenderizar la respuesta.
 */
export async function GET() {
  await connection();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[db-health] Error conectando a PostgreSQL:", error);

    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
