import { z } from "zod";

import { handleApiError } from "@/src/lib/api/errors";
import { parseSearchParams } from "@/src/lib/api/request";
import { lookupDni } from "@/src/lib/decolecta";

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
    const { numero } = parseSearchParams(request, dniQuerySchema);
    const data = await lookupDni(numero);

    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
