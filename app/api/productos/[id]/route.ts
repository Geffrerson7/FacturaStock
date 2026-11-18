import { Prisma } from "@/src/generated/prisma/client";
import type { ConflictOptions } from "@/src/lib/api/errors";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { removeProductImageIfUnused } from "@/src/lib/api/product";
import { parseJsonBody } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  productIdSchema,
  updateProductSchema,
} from "@/src/lib/validations/product";

const PRODUCT_CONFLICT: ConflictOptions = {
  code: "PRODUCT_ALREADY_EXISTS",
  entity: "un producto",
  fields: ["sku"],
};

function parseProductId(id: string) {
  const result = productIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador del producto no es válido.",
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

function productNotFound() {
  return new ApiError(404, "PRODUCT_NOT_FOUND", "El producto no existe.");
}

async function ensureCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La categoría seleccionada no existe.",
      { field: "categoryId" },
    );
  }
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/productos/[id]">,
) {
  try {
    await requireSession(request);

    const { id } = await ctx.params;
    const productId = parseProductId(id);
    const data = await parseJsonBody(request, updateProductSchema);

    await ensureCategoryExists(data.categoryId);

    const previous = await prisma.product.findUnique({
      where: { id: productId },
      select: { imagePublicId: true },
    });

    if (!previous) {
      throw productNotFound();
    }

    try {
      const product = await prisma.product.update({
        where: { id: productId },
        data,
        include: { category: true },
      });

      // La imagen anterior se borra de Cloudinary si se reemplazó o se quitó.
      if (previous.imagePublicId !== product.imagePublicId) {
        await removeProductImageIfUnused(previous.imagePublicId);
      }

      return Response.json({ data: product }, { status: 200 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw productNotFound();
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(error, PRODUCT_CONFLICT);
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/productos/[id]">,
) {
  try {
    await requireSession(request);

    const { id } = await ctx.params;
    const productId = parseProductId(id);

    // El kárdex es un registro contable: un producto con movimientos no se
    // borra, se desactiva.
    const movements = await prisma.stockMovement.count({
      where: { productId },
    });

    if (movements > 0) {
      throw new ApiError(
        409,
        "PRODUCT_HAS_MOVEMENTS",
        "El producto tiene movimientos en el kárdex y no se puede eliminar. Desactívalo para que no aparezca en las ventas.",
      );
    }

    try {
      const deleted = await prisma.product.delete({
        where: { id: productId },
        select: { imagePublicId: true },
      });

      await removeProductImageIfUnused(deleted.imagePublicId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw productNotFound();
      }

      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, PRODUCT_CONFLICT);
  }
}
