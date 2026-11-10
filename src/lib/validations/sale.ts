import { z } from "zod";

export const saleIdSchema = z.uuid("Sale id must be a valid UUID.");

const optionalCustomerId = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.uuid("Customer id must be a valid UUID.").nullable(),
);

export const createSaleItemSchema = z.object({
  productId: z.uuid("Product id must be a valid UUID."),
  quantity: z.coerce
    .number()
    .int("Quantity must be an integer.")
    .min(1, "Quantity must be at least 1.")
    .max(1000000, "Quantity is too large."),
});

export const createSaleSchema = z.object({
  customerId: optionalCustomerId,
  items: z
    .array(createSaleItemSchema)
    .min(1, "At least one item is required."),
});

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
