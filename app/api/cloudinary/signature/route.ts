import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { requireSession } from "@/src/lib/api/session";
import { signProductImageUpload } from "@/src/lib/cloudinary";

function getApiSecret(): string {
  let secret = process.env.CLOUDINARY_API_SECRET;

  // CLOUDINARY_URL tiene el formato cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  if (!secret) {
    const url = process.env.CLOUDINARY_URL;
    const match = url?.match(/^cloudinary:\/\/[^:]+:([^@]+)@/);
    secret = match?.[1];
  }

  if (!secret) {
    throw new ApiError(
      500,
      "CLOUDINARY_NOT_CONFIGURED",
      "Cloudinary no está configurado. Define CLOUDINARY_API_SECRET o CLOUDINARY_URL.",
    );
  }

  return secret.replace(/^["']|["']$/g, "");
}

/**
 * Firma una subida de imagen de producto a Cloudinary.
 *
 * POST /api/cloudinary/signature
 *
 * No acepta parámetros del cliente: el servidor fija la carpeta y el
 * timestamp, y devuelve ambos junto con la firma.
 */
export async function POST(request: Request) {
  try {
    await requireSession(request);

    return Response.json(signProductImageUpload(getApiSecret()));
  } catch (error) {
    return handleApiError(error);
  }
}
