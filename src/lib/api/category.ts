import type { Prisma } from "@/src/generated/prisma/client";

export const CATEGORY_INCLUDE = {
  _count: { select: { products: true } },
} satisfies Prisma.CategoryInclude;

export type CategoryWithCount = Prisma.CategoryGetPayload<{
  include: typeof CATEGORY_INCLUDE;
}>;

/** Convierte `_count.products` en un campo plano `productCount`. */
export function mapCategory(category: CategoryWithCount) {
  const { _count, ...rest } = category;

  return { ...rest, productCount: _count.products };
}
