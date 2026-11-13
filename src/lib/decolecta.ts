import { ApiError } from "@/src/lib/api/errors";

/**
 * Cliente de la API de Decolecta para consultar DNI (RENIEC) y RUC (SUNAT).
 *
 * Solo se usa en el servidor: el token viaja en la cabecera Authorization y
 * nunca debe llegar al navegador.
 */

const DECOLECTA_BASE_URL = "https://api.decolecta.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;

type DecolectaDniResponse = {
  first_name?: string | null;
  first_last_name?: string | null;
  second_last_name?: string | null;
  full_name?: string | null;
  document_number?: string | null;
};

type DecolectaRucResponse = {
  razon_social?: string | null;
  numero_documento?: string | null;
  estado?: string | null;
  condicion?: string | null;
  direccion?: string | null;
};

export type DniLookup = {
  documentType: "DNI";
  documentNumber: string;
  firstName: string;
  lastName: string;
};

export type RucLookup = {
  documentType: "RUC";
  documentNumber: string;
  businessName: string;
  address: string | null;
  status: string | null;
};

export type DocumentLookup = DniLookup | RucLookup;

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();

  return text ? text : null;
}

function getToken(): string {
  const token = process.env.DECOLECTA_API_TOKEN;

  if (!token) {
    throw new ApiError(
      500,
      "DECOLECTA_NOT_CONFIGURED",
      "El servicio de consulta de documentos no está configurado. Define DECOLECTA_API_TOKEN.",
    );
  }

  return token;
}

async function fetchDocument<T>(
  path: "/reniec/dni" | "/sunat/ruc",
  numero: string,
): Promise<T> {
  const token = getToken();
  let response: Response;

  try {
    response = await fetch(
      `${DECOLECTA_BASE_URL}${path}?numero=${encodeURIComponent(numero)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    console.error("[decolecta] Error de red:", error);

    throw new ApiError(
      502,
      "DOCUMENT_LOOKUP_UNAVAILABLE",
      "No se pudo conectar con el servicio de consulta de documentos. Inténtalo de nuevo.",
    );
  }

  if (response.status === 404) {
    throw new ApiError(
      404,
      "DOCUMENT_NOT_FOUND",
      `No se encontró información para el documento ${numero}. Verifica el número e inténtalo de nuevo.`,
    );
  }

  if (response.status === 422) {
    throw new ApiError(
      400,
      "INVALID_DOCUMENT",
      "El número de documento no es válido. Verifica el número e inténtalo de nuevo.",
    );
  }

  if (!response.ok) {
    // 401/403 indican un token inválido o sin permisos: es un problema de
    // configuración, no del usuario, así que no se expone el detalle.
    console.error(
      `[decolecta] Respuesta HTTP ${response.status} al consultar ${path}. Revisa DECOLECTA_API_TOKEN.`,
    );

    throw new ApiError(
      502,
      "DOCUMENT_LOOKUP_UNAVAILABLE",
      "El servicio de consulta de documentos no está disponible. Inténtalo más tarde.",
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!data || typeof data !== "object") {
    throw new ApiError(
      502,
      "DOCUMENT_LOOKUP_UNAVAILABLE",
      "El servicio de consulta de documentos devolvió una respuesta inválida.",
    );
  }

  return data as T;
}

export async function lookupDni(numero: string): Promise<DniLookup> {
  const data = await fetchDocument<DecolectaDniResponse>(
    "/reniec/dni",
    numero,
  );

  const firstName = clean(data.first_name);
  const lastNames = [clean(data.first_last_name), clean(data.second_last_name)]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  if (!firstName && !lastNames) {
    throw new ApiError(
      404,
      "DOCUMENT_NOT_FOUND",
      `No se encontró información para el DNI ${numero}. Verifica el número e inténtalo de nuevo.`,
    );
  }

  return {
    documentType: "DNI",
    documentNumber: clean(data.document_number) ?? numero,
    firstName: firstName ?? "",
    lastName: lastNames,
  };
}

export async function lookupRuc(numero: string): Promise<RucLookup> {
  const data = await fetchDocument<DecolectaRucResponse>("/sunat/ruc", numero);
  const businessName = clean(data.razon_social);

  if (!businessName) {
    throw new ApiError(
      404,
      "DOCUMENT_NOT_FOUND",
      `No se encontró información para el RUC ${numero}. Verifica el número e inténtalo de nuevo.`,
    );
  }

  return {
    documentType: "RUC",
    documentNumber: clean(data.numero_documento) ?? numero,
    businessName,
    address: clean(data.direccion),
    status: clean(data.estado),
  };
}
