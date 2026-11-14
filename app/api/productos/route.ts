import type { ConflictOptions } from "@/src/lib/api/errors";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import {
  buildProductOrderBy,
  buildProductWhere,
} from "@/src/lib/api/product";
import {
  paginatedResponse,
  parseJsonBody,
  parseSearchParams,
} from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  createProductSchema,
  listProductsQuerySchema,
} from "@/src/lib/validations/product";

const PRODUCT_CONFLICT: ConflictOptions = {
  code: "PRODUCT_ALREADY_EXISTS",
  entity: "un producto",
  fields: ["sku"],
};

function categoryNotFound() {
  return new ApiError(
    400,
    "VALIDATION_ERROR",
    "La categoría seleccionada no existe.",
    { field: "categoryId" },
  );
}

export async function GET(request: Request) {
  try {
    await requireSession(request);

    const query = parseSearchParams(request, listProductsQuerySchema);
    const { page, pageSize } = query;
    const where = buildProductWhere(query);

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: buildProductOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return paginatedResponse(products, total, { page, pageSize });
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
