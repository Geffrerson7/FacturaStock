import { z } from "zod";

import { paginationQuery, searchQuery, sortQuery } from "./list";

export const categoryIdSchema = z.uuid(
  "El identificador de la categoría no es válido.",
);

const optionalDescription = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string("La descripción debe ser un texto.")
      .trim()
      .max(200, "La descripción no puede superar los 200 caracteres.")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

export const createCategorySchema = z.object({
  name: z
    .string("El nombre de la categoría es obligatorio.")
    .trim()
    .min(1, "El nombre de la categoría es obligatorio.")
    .max(80, "El nombre no puede superar los 80 caracteres."),
  description: optionalDescription,
});

export const updateCategorySchema = createCategorySchema;

export const CATEGORY_SORT_FIELDS = [
  "name",
  "createdAt",
  "productCount",
] as const;

export const listCategoriesQuerySchema = z.object({
  ...paginationQuery,
  q: searchQuery,
  ...sortQuery(CATEGORY_SORT_FIELDS, { sort: "name", order: "asc" }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
