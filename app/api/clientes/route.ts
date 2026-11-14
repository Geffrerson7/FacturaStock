import { handleApiError } from "@/src/lib/api/errors";
import { normalizeCustomerData } from "@/src/lib/api/customer-data";
import { parseJsonBody, parseSearchParams } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";
import {
  createCustomerSchema,
  listCustomersQuerySchema,
} from "@/src/lib/validations/customer";

export async function POST(request: Request) {
  try {
    await requireSession(request);

    const data = await parseJsonBody(request, createCustomerSchema);
    const customer = await prisma.customer.create({
      data: normalizeCustomerData(data),
    });

    return Response.json({ data: customer }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireSession(request);

    const { page, pageSize } = parseSearchParams(
      request,
      listCustomersQuerySchema,
    );

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return Response.json(
      {
        data: customers,
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