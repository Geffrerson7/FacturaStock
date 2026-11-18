import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { parseJsonBody } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { rebuildProductKardex } from "@/src/lib/kardex/engine";
import { prisma } from "@/src/lib/prisma";
import { productIdSchema } from "@/src/lib/validations/product";
import { initialCostSchema } from "@/src/lib/validations/kardex";

/**
 * Corrige el costo del saldo inicial de un producto. Solo mientras el saldo
 * inicial sea su único movimiento; después, el costo se corrige con un
 * ajuste de valorización, que deja rastro en el kárdex.
 */
export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/productos/[id]/costo-inicial">,
) {
  try {
    await requireSession(request);

    const { id } = await ctx.params;
    const parsedId = productIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "El identificador del producto no es válido.",
      );
    }

    const productId = parsedId.data;
    const { unitCost } = await parseJsonBody(request, initialCostSchema);

    const product = await prisma.$transaction(async (tx) => {
      const movements = await tx.stockMovement.findMany({
        where: { productId },
        orderBy: { sequence: "asc" },
        take: 2,
        select: { id: true, type: true },
      });

      if (movements.length === 0) {
        throw new ApiError(
          404,
          "INITIAL_BALANCE_NOT_FOUND",
          "El producto no tiene saldo inicial.",
        );
      }

      if (movements.length > 1 || movements[0].type !== "SALDO_INICIAL") {
        throw new ApiError(
          409,
          "INITIAL_BALANCE_LOCKED",
          "El producto ya tiene movimientos posteriores al saldo inicial. Corrige el costo con un ajuste de valorización.",
        );
      }

      await tx.stockMovement.update({
        where: { id: movements[0].id },
        data: { unitCost },
      });
      // Recalcula el total, el saldo y el costo del producto.
      await rebuildProductKardex(tx, productId);

      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { category: true },
      });
    });

    return Response.json({ data: product }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
