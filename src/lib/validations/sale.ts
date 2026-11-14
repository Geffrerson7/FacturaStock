import { z } from "zod";

import {
  emptyToUndefined,
  optionalEnum,
  paginationQuery,
  searchQuery,
  sortQuery,
} from "./list";

export const saleIdSchema = z.uuid("El identificador de la venta no es válido.");

const optionalCustomerId = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.uuid("El identificador del cliente no es válido.").nullable(),
);

export const createSaleItemSchema = z.object({
  productId: z.uuid("El identificador del producto no es válido."),
  quantity: z.coerce
    .number("La cantidad debe ser un número.")
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad debe ser al menos 1.")
    .max(1000000, "La cantidad es demasiado alta."),
});

export const createSaleSchema = z.object({
  customerId: optionalCustomerId,
  items: z
    .array(createSaleItemSchema, "La venta debe incluir una lista de productos.")
    .min(1, "Agrega al menos un producto."),
});

export const SALE_SORT_FIELDS = ["createdAt", "number", "total"] as const;

export const SALE_STATUSES = ["COMPLETADA", "ANULADA"] as const;

export const INVOICE_STATUSES = [
  "PENDIENTE",
  "EMITIDO",
  "ANULADO",
  "ANULACION_PENDIENTE",
] as const;

// Fechas de calendario (AAAA-MM-DD), interpretadas en la hora de Lima.
const optionalDate = z.preprocess(
  emptyToUndefined,
  z.iso.date("La fecha debe tener el formato AAAA-MM-DD.").optional(),
);

export const listSalesQuerySchema = z
  .object({
    ...paginationQuery,
    q: searchQuery,
    status: optionalEnum(
      SALE_STATUSES,
      "El estado debe ser COMPLETADA o ANULADA.",
    ),
    invoiceStatus: optionalEnum(
      INVOICE_STATUSES,
      "El estado del comprobante no es válido.",
    ),
    from: optionalDate,
    to: optionalDate,
    ...sortQuery(SALE_SORT_FIELDS, { sort: "createdAt", order: "desc" }),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "La fecha final no puede ser anterior a la inicial.",
  });

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
