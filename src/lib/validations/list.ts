import { z } from "zod";

/** Un parámetro vacío (`?q=`) se trata igual que uno ausente. */
export function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** `page` y `pageSize`, comunes a todos los listados. */
export const paginationQuery = {
  page: z.coerce
    .number("La página debe ser un número.")
    .int("La página debe ser un número entero.")
    .min(1, "La página debe ser 1 o mayor.")
    .default(1),
  pageSize: z.coerce
    .number("El tamaño de página debe ser un número.")
    .int("El tamaño de página debe ser un número entero.")
    .min(1, "El tamaño de página debe ser 1 o mayor.")
    .max(100, "El tamaño de página no puede superar 100.")
    .default(10),
};

/** Texto de búsqueda libre (`q`). */
export const searchQuery = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(100, "La búsqueda no puede superar los 100 caracteres.")
    .optional(),
);

/** Filtro opcional que solo acepta uno de los valores indicados. */
export function optionalEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) {
  return z.preprocess(emptyToUndefined, z.enum(values, message).optional());
}

/** Filtro booleano opcional: `true` o `false` como texto. */
export function optionalBoolean(message: string) {
  return z.preprocess(
    emptyToUndefined,
    z
      .enum(["true", "false"], message)
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  );
}

export const SORT_ORDERS = ["asc", "desc"] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

/** `sort` y `order`, limitados a las columnas que cada listado permite. */
export function sortQuery<const T extends readonly [string, ...string[]]>(
  fields: T,
  defaults: { sort: T[number]; order: SortOrder },
) {
  return {
    sort: z.preprocess(
      emptyToUndefined,
      z
        .enum(fields, `El orden debe ser uno de: ${fields.join(", ")}.`)
        .default(defaults.sort),
    ),
    order: z.preprocess(
      emptyToUndefined,
      z
        .enum(SORT_ORDERS, "La dirección del orden debe ser asc o desc.")
        .default(defaults.order),
    ),
  };
}

/** Separa la búsqueda en palabras; cada una debe coincidir con algún campo. */
export function searchTokens(q: string | undefined): string[] {
  return q ? q.split(/\s+/).filter(Boolean).slice(0, 8) : [];
}
