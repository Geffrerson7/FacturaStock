import { handleApiError } from "@/src/lib/api/errors";
import {
  buildCustomerOrderBy,
  buildCustomerWhere,
  normalizeCustomerData,
} from "@/src/lib/api/customer-data";
import {
  paginatedResponse,
  parseJsonBody,
  parseSearchParams,
} from "@/src/lib/api/request";
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

    const query = parseSearchParams(request, listCustomersQuerySchema);
    const { page, pageSize } = query;
    // El cliente walk-in nunca aparece en el listado.
    const where = buildCustomerWhere(query);

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: buildCustomerOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return paginatedResponse(customers, total, { page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
