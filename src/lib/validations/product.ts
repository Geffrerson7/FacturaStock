import { z } from "zod";

export const productIdSchema = z.uuid("Product id must be a valid UUID.");

const optionalDescription = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string()
      .trim()
      .max(255, "Description must be at most 255 characters.")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalImageUrl = z
  .preprocess(
    emptyToNull,
    z
      .url("Image URL must be a valid URL.")
      .max(500, "Image URL must be at most 500 characters.")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const optionalImagePublicId = z
  .preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(255, "Cloudinary public id must be at most 255 characters.")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required.")
    .max(120, "Product name must be at most 120 characters."),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required.")
    .max(50, "SKU must be at most 50 characters."),
  description: optionalDescription,
  price: z.coerce
    .number()
    .finite("Price must be a valid number.")
    .min(0, "Price cannot be negative.")
    .max(99999999.99, "Price is too large."),
  stock: z.coerce
    .number()
    .int("Stock must be an integer.")
    .min(0, "Stock cannot be negative.")
    .max(1000000, "Stock is too large."),
  categoryId: z.uuid("Category id must be a valid UUID."),
  isActive: z.boolean().default(true),
  imageUrl: optionalImageUrl,
  imagePublicId: optionalImagePublicId,
});

export const updateProductSchema = createProductSchema;

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
