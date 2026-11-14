import { createHash } from "node:crypto";

/** Única carpeta en la que se permite subir imágenes. */
export const PRODUCT_IMAGE_FOLDER = "facturastock/products";

export type SignedUploadParams = {
  folder: string;
  timestamp: number;
  signature: string;
};

/**
 * Firma una subida a Cloudinary.
 *
 * La firma es `sha1(params ordenados + api_secret)`, el mismo algoritmo que
 * usa `cloudinary.utils.api_sign_request`. Los parámetros los decide el
 * servidor: la firma solo sirve para subir a `PRODUCT_IMAGE_FOLDER` con el
 * `timestamp` devuelto, y Cloudinary la rechaza pasada una hora.
 */
export function signProductImageUpload(
  apiSecret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): SignedUploadParams {
  const params: Record<string, string | number> = {
    folder: PRODUCT_IMAGE_FOLDER,
    timestamp,
  };

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return {
    folder: PRODUCT_IMAGE_FOLDER,
    timestamp,
    signature: createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex"),
  };
}
