import { z } from "zod";

import { handleApiError } from "@/src/lib/api/errors";
import { parseSearchParams } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { lookupRuc } from "@/src/lib/decolecta";
import { enforceDocumentLookupLimit } from "@/src/lib/rate-limit";

const rucQuerySchema = z.object({
  numero: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 dígitos."),
});

/**
 * Consulta los datos de un RUC en SUNAT a través de Decolecta.
 *
 * GET /api/consulta/ruc?numero=20601030013
 */
export async function GET(request: Request) {
  try {
    // Cada consulta gasta cuota de Decolecta: requiere una cuenta con permisos
    // de escritura y tiene límite de peticiones por usuario.
    const user = await requireSession(request, { allowDemo: false });
    enforceDocumentLookupLimit(user.id);

    const { numero } = parseSearchParams(request, rucQuerySchema);
    const data = await lookupRuc(numero);

    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
