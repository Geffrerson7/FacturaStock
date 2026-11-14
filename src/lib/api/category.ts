import type { Prisma } from "@/src/generated/prisma/client";
import type { ListCategoriesQuery } from "@/src/lib/validations/category";
import { searchTokens } from "@/src/lib/validations/list";

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

export function buildCategoryWhere({
  q,
}: Pick<ListCategoriesQuery, "q">): Prisma.CategoryWhereInput {
  return {
    AND: searchTokens(q).map((token) => ({
      OR: [
        { name: { contains: token, mode: "insensitive" as const } },
        { description: { contains: token, mode: "insensitive" as const } },
      ],
    })),
  };
}

export function buildCategoryOrderBy({
  sort,
  order,
}: Pick<
  ListCategoriesQuery,
  "sort" | "order"
>): Prisma.CategoryOrderByWithRelationInput[] {
  const primary: Prisma.CategoryOrderByWithRelationInput =
    sort === "productCount"
      ? { products: { _count: order } }
      : { [sort]: order };

  // El id desempata para que la paginación sea estable.
  return [primary, { id: order }];
}
