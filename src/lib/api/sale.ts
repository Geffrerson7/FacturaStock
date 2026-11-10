import type { Prisma } from "@/src/generated/prisma/client";

import { ApiError } from "./errors";
import { saleIdSchema } from "@/src/lib/validations/sale";

export const SALE_INCLUDE = {
  customer: true,
  items: { orderBy: { createdAt: "asc" as const } },
  invoice: true,
} satisfies Prisma.SaleInclude;

export type SaleWithInvoice = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

export function parseSaleId(id: string) {
  const result = saleIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Sale id is invalid.", {
      details: result.error.issues.map((issue) => ({
        path: "id",
        message: issue.message,
      })),
    });
  }

  return result.data;
}
