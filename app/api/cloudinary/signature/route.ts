import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { requireSession } from "@/src/lib/api/session";
import {
  getCloudinaryApiSecret,
  signProductImageUpload,
} from "@/src/lib/cloudinary";

function getApiSecret(): string {
  const secret = getCloudinaryApiSecret();

  if (!secret) {
    throw new ApiError(
      500,
      "CLOUDINARY_NOT_CONFIGURED",
      "Cloudinary no está configurado. Define CLOUDINARY_API_SECRET o CLOUDINARY_URL.",
    );
  }

  return secret;
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
