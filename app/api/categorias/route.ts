import type { ConflictOptions } from "@/src/lib/api/errors";
import { handleApiError } from "@/src/lib/api/errors";
import { CATEGORY_INCLUDE, mapCategory } from "@/src/lib/api/category";
import { parseJsonBody, parseSearchParams } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from "@/src/lib/validations/category";

const CATEGORY_CONFLICT: ConflictOptions = {
  code: "CATEGORY_ALREADY_EXISTS",
  entity: "category",
  fields: ["name"],
};

export async function GET(request: Request) {
  try {
    await requireSession(request);

    const { page, pageSize } = parseSearchParams(
      request,
      listCategoriesQuerySchema,
    );

    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({
        include: CATEGORY_INCLUDE,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return Response.json(
      {
        data: categories.map(mapCategory),
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
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);

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
