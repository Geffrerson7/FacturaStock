import { z } from "zod";

export const categoryIdSchema = z.uuid("Category id must be a valid UUID.");

const optionalDescription = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string()
      .trim()
      .max(200, "Description must be at most 200 characters.")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(80, "Category name must be at most 80 characters."),
  description: optionalDescription,
});

export const updateCategorySchema = createCategorySchema;

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
