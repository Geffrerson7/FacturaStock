import { createHash } from "node:crypto";

/** Única carpeta en la que se permite subir (y borrar) imágenes. */
export const PRODUCT_IMAGE_FOLDER = "facturastock/products";

export type SignedUploadParams = {
  folder: string;
  timestamp: number;
  signature: string;
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function unquote(value: string | undefined): string | undefined {
  return value?.trim().replace(/^["']|["']$/g, "") || undefined;
}

/**
 * Lee la configuración del entorno. Acepta las variables sueltas o
 * `CLOUDINARY_URL`, con el formato cloudinary://API_KEY:API_SECRET@CLOUD_NAME.
 */
function readConfig(): Partial<CloudinaryConfig> {
  const fromUrl = unquote(process.env.CLOUDINARY_URL)?.match(
    /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/,
  );

  return {
    cloudName:
      unquote(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) ?? fromUrl?.[3],
    apiKey: unquote(process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY) ?? fromUrl?.[1],
    apiSecret: unquote(process.env.CLOUDINARY_API_SECRET) ?? fromUrl?.[2],
  };
}

/** API secret de Cloudinary, o `null` si no está configurado. */
export function getCloudinaryApiSecret(): string | null {
  return readConfig().apiSecret ?? null;
}

/** `sha1(params ordenados + api_secret)`, como `api_sign_request`. */
function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

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
  return {
    folder: PRODUCT_IMAGE_FOLDER,
    timestamp,
    signature: signParams({ folder: PRODUCT_IMAGE_FOLDER, timestamp }, apiSecret),
  };
}

/** Solo se borran imágenes de la carpeta de productos de esta aplicación. */
export function isManagedProductImage(publicId: string): boolean {
  return (
    publicId.startsWith(`${PRODUCT_IMAGE_FOLDER}/`) && !publicId.includes("..")
  );
}

/**
 * Borra una imagen de producto en Cloudinary.
 *
 * Devuelve `true` si se borró y `false` si no había nada que hacer: la imagen
 * no es de la carpeta de productos (el `public_id` lo envía el navegador, así
 * que no se confía en él), Cloudinary no está configurado o ya no existía.
 * Lanza un error si Cloudinary rechaza la petición.
 */
export async function destroyProductImage(publicId: string): Promise<boolean> {
  if (!isManagedProductImage(publicId)) return false;

  const { cloudName, apiKey, apiSecret } = readConfig();

  if (!cloudName || !apiKey || !apiSecret) return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: signParams({ public_id: publicId, timestamp }, apiSecret),
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
    { method: "POST", body, cache: "no-store" },
  );
  const payload = (await response.json().catch(() => null)) as {
    result?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? `Cloudinary respondió HTTP ${response.status}.`,
    );
  }

  return payload?.result === "ok";
}
