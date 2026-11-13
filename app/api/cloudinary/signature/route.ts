import { createHash } from "node:crypto";

import { z } from "zod";

import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { parseJsonBody } from "@/src/lib/api/request";

const signatureRequestSchema = z.object({
  paramsToSign: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
});

/**
 * Firma los parámetros de una subida a Cloudinary.
 *
 * La firma es `sha1(params ordenados + api_secret)`, el mismo algoritmo que
 * usa `cloudinary.utils.api_sign_request`. El API secret nunca sale del
 * servidor.
 */
function signParams(
  params: Record<string, string | number | boolean>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

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
 * Firma las subidas a Cloudinary.
 *
 * POST /api/cloudinary/signature
 */
export async function POST(request: Request) {
  try {
    const { paramsToSign } = await parseJsonBody(
      request,
      signatureRequestSchema,
    );

    return Response.json({
      signature: signParams(paramsToSign, getApiSecret()),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
