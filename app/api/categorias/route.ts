import type { ConflictOptions } from "@/src/lib/api/errors";
import { handleApiError } from "@/src/lib/api/errors";
import {
  buildCategoryOrderBy,
  buildCategoryWhere,
  CATEGORY_INCLUDE,
  mapCategory,
} from "@/src/lib/api/category";
import {
  paginatedResponse,
  parseJsonBody,
  parseSearchParams,
} from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from "@/src/lib/validations/category";

const CATEGORY_CONFLICT: ConflictOptions = {
  code: "CATEGORY_ALREADY_EXISTS",
  entity: "una categoría",
  fields: ["name"],
};

export async function GET(request: Request) {
  try {
    await requireSession(request);

    const query = parseSearchParams(request, listCategoriesQuerySchema);
    const { page, pageSize } = query;
    const where = buildCategoryWhere(query);

    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({
        where,
        include: CATEGORY_INCLUDE,
        orderBy: buildCategoryOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);

    return paginatedResponse(categories.map(mapCategory), total, {
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request, { adminOnly: true });

    const data = await parseJsonBody(request, createCategorySchema);
    const category = await prisma.category.create({
      data,
      include: CATEGORY_INCLUDE,
    });

    return Response.json({ data: mapCategory(category) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, CATEGORY_CONFLICT);
  }
}
