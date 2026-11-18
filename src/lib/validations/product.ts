import { z } from "zod";

import {
  emptyToUndefined,
  optionalBoolean,
  paginationQuery,
  searchQuery,
  sortQuery,
} from "./list";

/** Igual que el valor por defecto de la columna `low_stock_threshold`. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const productIdSchema = z.uuid(
  "El identificador del producto no es válido.",
);

const optionalDescription = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string("La descripción debe ser un texto.")
      .trim()
      .max(255, "La descripción no puede superar los 255 caracteres.")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const DEMO_IMAGE_PATH = /^\/demo\/products\/[a-z0-9-]+\.svg$/;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalImageUrl = z
  .preprocess(
    emptyToNull,
    z
      .union(
        [
          z.url().max(500),
          // Ilustraciones de los productos de la demo, servidas desde /public.
          z.string().regex(DEMO_IMAGE_PATH),
        ],
        "La URL de la imagen no es válida.",
      )
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const optionalImagePublicId = z
  .preprocess(
    emptyToNull,
    z
      .string("El identificador de la imagen debe ser un texto.")
      .trim()
      .max(
        255,
        "El identificador de la imagen no puede superar los 255 caracteres.",
      )
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

/**
 * Costo unitario opcional (sin IGV), hasta 6 decimales. Un campo vacío es
 * "sin costo": el motor del kárdex decide qué costo usar.
 */
export const unitCostField = z.preprocess(
  emptyToNull,
  z.coerce
    .number("El costo debe ser un número válido.")
    .min(0, "El costo no puede ser negativo.")
    .max(99999999, "El costo es demasiado alto.")
    .nullable()
    .optional()
    .transform((value) =>
      value === null || value === undefined
        ? null
        : Math.round(value * 1e6) / 1e6,
    ),
);

export const createProductSchema = z.object({
  name: z
    .string("El nombre del producto es obligatorio.")
    .trim()
    .min(1, "El nombre del producto es obligatorio.")
    .max(120, "El nombre no puede superar los 120 caracteres."),
  sku: z
    .string("El SKU es obligatorio.")
    .trim()
    .min(1, "El SKU es obligatorio.")
    .max(50, "El SKU no puede superar los 50 caracteres."),
  description: optionalDescription,
  price: z.coerce
    .number("El precio debe ser un número válido.")
    .min(0, "El precio no puede ser negativo.")
    .max(99999999.99, "El precio es demasiado alto."),
  // Stock inicial: solo al crear. Después el stock cambia únicamente con
  // movimientos del kárdex.
  stock: z.coerce
    .number("El stock debe ser un número válido.")
    .int("El stock debe ser un número entero.")
    .min(0, "El stock no puede ser negativo.")
    .max(1000000, "El stock es demasiado alto."),
  // Costo unitario del stock inicial. Opcional: sin él, el saldo inicial
  // entra a costo 0 y se puede corregir después.
  initialCost: unitCostField,
  lowStockThreshold: z.coerce
    .number("El umbral de stock bajo debe ser un número válido.")
    .int("El umbral de stock bajo debe ser un número entero.")
    .min(0, "El umbral de stock bajo no puede ser negativo.")
    .max(1000000, "El umbral de stock bajo es demasiado alto.")
    .default(DEFAULT_LOW_STOCK_THRESHOLD),
  categoryId: z.uuid("Selecciona una categoría válida."),
  isActive: z.boolean("El estado debe ser verdadero o falso.").default(true),
  imageUrl: optionalImageUrl,
  imagePublicId: optionalImagePublicId,
});

// Al editar no se acepta `stock` ni `initialCost`: si llegan, se descartan.
export const updateProductSchema = createProductSchema.omit({
  stock: true,
  initialCost: true,
});

export const PRODUCT_SORT_FIELDS = [
  "createdAt",
  "name",
  "sku",
  "price",
  "stock",
] as const;

export const listProductsQuerySchema = z.object({
  ...paginationQuery,
  q: searchQuery,
  categoryId: z.preprocess(
    emptyToUndefined,
    z.uuid("El identificador de la categoría no es válido.").optional(),
  ),
  isActive: optionalBoolean("El filtro isActive debe ser true o false."),
  lowStock: optionalBoolean("El filtro lowStock debe ser true o false."),
  ...sortQuery(PRODUCT_SORT_FIELDS, { sort: "createdAt", order: "desc" }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
