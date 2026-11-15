import type { Prisma } from "@/src/generated/prisma/client";
import { destroyProductImage } from "@/src/lib/cloudinary";
import { prisma } from "@/src/lib/prisma";
import { searchTokens } from "@/src/lib/validations/list";
import type { ListProductsQuery } from "@/src/lib/validations/product";

/**
 * Productos con stock bajo: el stock se compara con el umbral de la misma
 * fila, así que el filtro va a la base en vez de calcularse en memoria.
 */
export function lowStockWhere(): Prisma.ProductWhereInput {
  return { stock: { lte: prisma.product.fields.lowStockThreshold } };
}

export function buildProductWhere({
  q,
  categoryId,
  isActive,
  lowStock,
}: Pick<ListProductsQuery, "q" | "categoryId" | "isActive"> &
  Partial<Pick<ListProductsQuery, "lowStock">>): Prisma.ProductWhereInput {
  return {
    AND: [
      ...(categoryId ? [{ categoryId }] : []),
      ...(isActive === undefined ? [] : [{ isActive }]),
      ...(lowStock ? [lowStockWhere()] : []),
      ...searchTokens(q).map((token) => ({
        OR: [
          { name: { contains: token, mode: "insensitive" as const } },
          { sku: { contains: token, mode: "insensitive" as const } },
        ],
      })),
    ],
  };
}

export function buildProductOrderBy({
  sort,
  order,
}: Pick<
  ListProductsQuery,
  "sort" | "order"
>): Prisma.ProductOrderByWithRelationInput[] {
  // El id desempata para que la paginación sea estable.
  return [{ [sort]: order }, { id: order }];
}

/**
 * Borra de Cloudinary una imagen que un producto dejó de usar (se reemplazó,
 * se quitó o se eliminó el producto).
 *
 * Nunca lanza: si Cloudinary falla, el cambio en la base ya está hecho y solo
 * queda el archivo huérfano, que es el comportamiento anterior.
 */
export async function removeProductImageIfUnused(
  publicId: string | null,
): Promise<void> {
  if (!publicId) return;

  try {
    // El public_id llega del navegador: otro producto podría compartirlo.
    const stillUsed = await prisma.product.count({
      where: { imagePublicId: publicId },
    });

    if (stillUsed > 0) return;

    await destroyProductImage(publicId);
  } catch (error) {
    console.error(`[cloudinary] No se pudo borrar ${publicId}:`, error);
  }
}
