import type { ConflictOptions } from "@/src/lib/api/errors";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { parseJsonBody, parseSearchParams } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  createProductSchema,
  listProductsQuerySchema,
} from "@/src/lib/validations/product";

const PRODUCT_CONFLICT: ConflictOptions = {
  code: "PRODUCT_ALREADY_EXISTS",
  entity: "product",
  fields: ["sku"],
};

function categoryNotFound() {
  return new ApiError(
    400,
    "VALIDATION_ERROR",
    "The selected category does not exist.",
    { field: "categoryId" },
  );
}

export async function GET(request: Request) {
  try {
    await requireSession(request);

    const { page, pageSize } = parseSearchParams(
      request,
      listProductsQuerySchema,
    );

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        include: { category: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return Response.json(
      {
        data: products,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, PRODUCT_CONFLICT);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);

    const data = await parseJsonBody(request, createProductSchema);

    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw categoryNotFound();
    }

    const product = await prisma.product.create({
      data,
      include: { category: true },
    });

    return Response.json({ data: product }, { status: 201 });
  } catch (error) {
    return handleApiError(error, PRODUCT_CONFLICT);
  }
}
