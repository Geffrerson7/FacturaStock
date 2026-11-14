import { z } from "zod";

import { handleApiError } from "@/src/lib/api/errors";
import { parseSearchParams } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { lookupDni } from "@/src/lib/decolecta";
import { enforceDocumentLookupLimit } from "@/src/lib/rate-limit";

const dniQuerySchema = z.object({
  numero: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos."),
});

/**
 * Consulta los datos de un DNI en RENIEC a través de Decolecta.
 *
 * GET /api/consulta/dni?numero=46027897
 */
export async function GET(request: Request) {
  try {
    // Cada consulta gasta cuota de Decolecta: requiere una cuenta con permisos
    // de escritura y tiene límite de peticiones por usuario.
    const user = await requireSession(request, { allowDemo: false });
    enforceDocumentLookupLimit(user.id);

    const { numero } = parseSearchParams(request, dniQuerySchema);
    const data = await lookupDni(numero);

    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
