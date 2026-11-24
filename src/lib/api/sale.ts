import type { Prisma } from "@/src/generated/prisma/client";

import { ApiError } from "./errors";
import { customerTextFilters } from "./customer-data";
import { addDays, limaMidnight } from "@/src/lib/lima-time";
import { searchTokens } from "@/src/lib/validations/list";
import { saleIdSchema, type ListSalesQuery } from "@/src/lib/validations/sale";

export const SALE_INCLUDE = {
  customer: true,
  seller: { select: { id: true, name: true } },
  items: { orderBy: { createdAt: "asc" as const } },
  invoice: true,
} satisfies Prisma.SaleInclude;

export type SaleWithInvoice = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

export function parseSaleId(id: string) {
  const result = saleIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador de la venta no es válido.",
      {
        details: result.error.issues.map((issue) => ({
          path: "id",
          message: issue.message,
        })),
      },
    );
  }

  return result.data;
}

export function saleNotFound() {
  return new ApiError(404, "SALE_NOT_FOUND", "La venta no existe.");
}

export function saleAlreadyCancelled() {
  return new ApiError(
    409,
    "SALE_ALREADY_CANCELLED",
    "La venta ya fue anulada.",
  );
}

/** Una palabra de la búsqueda: número de venta o comprobante, cliente o producto. */
function saleTokenFilter(token: string): Prisma.SaleWhereInput {
  const contains = { contains: token, mode: "insensitive" as const };
  // Hasta 9 dígitos, para no salir del rango de un entero de PostgreSQL.
  const number = /^\d{1,9}$/.test(token) ? Number(token) : null;

  return {
    OR: [
      ...(number === null
        ? []
        : [{ number }, { invoice: { is: { number } } }]),
      { invoice: { is: { series: contains } } },
      { customer: { is: { OR: customerTextFilters(token) } } },
      { items: { some: { productName: contains } } },
    ],
  };
}

export function buildSaleWhere({
  q,
  status,
  invoiceStatus,
  from,
  to,
}: Pick<
  ListSalesQuery,
  "q" | "status" | "invoiceStatus" | "from" | "to"
>): Prisma.SaleWhereInput {
  return {
    AND: [
      ...(status ? [{ status }] : []),
      ...(invoiceStatus ? [{ invoice: { is: { status: invoiceStatus } } }] : []),
      ...(from ? [{ createdAt: { gte: limaMidnight(from) } }] : []),
      // `to` es inclusivo: llega hasta el final de ese día.
      ...(to
        ? [{ createdAt: { lt: addDays(limaMidnight(to), 1) } }]
        : []),
      ...searchTokens(q).map(saleTokenFilter),
    ],
  };
}

export function buildSaleOrderBy({
  sort,
  order,
}: Pick<
  ListSalesQuery,
  "sort" | "order"
>): Prisma.SaleOrderByWithRelationInput[] {
  // El número es único y desempata para que la paginación sea estable.
  return sort === "number"
    ? [{ number: order }]
    : [{ [sort]: order }, { number: order }];
}
