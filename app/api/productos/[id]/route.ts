import { Prisma } from "@/src/generated/prisma/client";
import type { ConflictOptions } from "@/src/lib/api/errors";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { parseJsonBody } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  productIdSchema,
  updateProductSchema,
} from "@/src/lib/validations/product";

const PRODUCT_CONFLICT: ConflictOptions = {
  code: "PRODUCT_ALREADY_EXISTS",
  entity: "product",
  fields: ["sku"],
};

function parseProductId(id: string) {
  const result = productIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Product id is invalid.", {
      details: result.error.issues.map((issue) => ({
        path: "id",
        message: issue.message,
      })),
    });
  }

  return result.data;
}

function productNotFound() {
  return new ApiError(
    404,
    "PRODUCT_NOT_FOUND",
    "The product does not exist.",
  );
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
      "The selected category does not exist.",
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

    try {
      const product = await prisma.product.update({
        where: { id: productId },
        data,
        include: { category: true },
      });

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

    try {
      await prisma.product.delete({ where: { id: productId } });
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
