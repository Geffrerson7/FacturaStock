import { Prisma } from "@/src/generated/prisma/client";
import { CATEGORY_INCLUDE, mapCategory } from "@/src/lib/api/category";
import type { ConflictOptions } from "@/src/lib/api/errors";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { parseJsonBody } from "@/src/lib/api/request";
import { prisma } from "@/src/lib/prisma";
import {
  categoryIdSchema,
  updateCategorySchema,
} from "@/src/lib/validations/category";

const CATEGORY_CONFLICT: ConflictOptions = {
  code: "CATEGORY_ALREADY_EXISTS",
  entity: "category",
  fields: ["name"],
};

function parseCategoryId(id: string) {
  const result = categoryIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Category id is invalid.", {
      details: result.error.issues.map((issue) => ({
        path: "id",
        message: issue.message,
      })),
    });
  }

  return result.data;
}

function categoryNotFound() {
  return new ApiError(
    404,
    "CATEGORY_NOT_FOUND",
    "The category does not exist.",
  );
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/categorias/[id]">,
) {
  try {
    const { id } = await ctx.params;
    const categoryId = parseCategoryId(id);
    const data = await parseJsonBody(request, updateCategorySchema);

    try {
      const category = await prisma.category.update({
        where: { id: categoryId },
        data,
        include: CATEGORY_INCLUDE,
      });

      return Response.json({ data: mapCategory(category) }, { status: 200 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw categoryNotFound();
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(error, CATEGORY_CONFLICT);
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/categorias/[id]">,
) {
  try {
    const { id } = await ctx.params;
    const categoryId = parseCategoryId(id);

    try {
      await prisma.category.delete({ where: { id: categoryId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw categoryNotFound();
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ApiError(
          409,
          "CATEGORY_IN_USE",
          "The category has products assigned and cannot be deleted.",
        );
      }

      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
