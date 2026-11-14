import { z } from "zod";

import { ApiError } from "./errors";

// Los mensajes que Zod genera por su cuenta (tipos, enums...) salen en español.
z.config(z.locales.es());

/** Respuesta de un listado paginado. */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
): Response {
  const totalPages = Math.ceil(total / pageSize);

  return Response.json(
    {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
    { status: 200 },
  );
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El cuerpo de la petición debe ser un JSON válido.",
    );
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Los datos enviados no son válidos.",
      { details },
    );
  }

  return result.data;
}

export function parseSearchParams<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): z.output<TSchema> {
  const { searchParams } = new URL(request.url);
  const result = schema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Los parámetros de la consulta no son válidos.",
      { details },
    );
  }

  return result.data;
}