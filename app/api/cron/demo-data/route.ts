import { timingSafeEqual } from "node:crypto";

import { syncDemoData } from "@/src/lib/demo-data/sync";
import { prisma } from "@/src/lib/prisma";

// El reinicio completo restaura el catálogo y regenera unas 300 ventas.
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");

  if (!secret || !header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

/**
 * GET /api/cron/demo-data
 *
 * Mantiene los datos de la demo pública: lo llama la tarea programada de
 * Vercel (`vercel.json`) con `Authorization: Bearer $CRON_SECRET`. Solo hace
 * algo si `DEMO_DATA_ENABLED=true`, para que nunca toque una base real.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
      { status: 401 },
    );
  }

  if (process.env.DEMO_DATA_ENABLED !== "true") {
    return Response.json({ data: { action: "disabled", salesCreated: 0 } });
  }

  try {
    const result = await syncDemoData(prisma);
    console.log(
      `[demo] ${result.action}: ${result.salesCreated} ventas de ejemplo creadas.`,
    );

    return Response.json({ data: result });
  } catch (error) {
    console.error("[demo] No se pudieron actualizar los datos de la demo:", error);

    return Response.json(
      {
        error: {
          code: "DEMO_SYNC_FAILED",
          message: "No se pudieron actualizar los datos de la demo.",
        },
      },
      { status: 500 },
    );
  }
}
