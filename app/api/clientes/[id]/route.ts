import { Prisma } from "@/src/generated/prisma/client";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { normalizeCustomerData } from "@/src/lib/api/customer-data";
import { parseJsonBody } from "@/src/lib/api/request";
import { prisma } from "@/src/lib/prisma";
import {
  customerIdSchema,
  updateCustomerSchema,
} from "@/src/lib/validations/customer";

function parseCustomerId(id: string) {
  const result = customerIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Customer id is invalid.", {
      details: result.error.issues.map((issue) => ({
        path: "id",
        message: issue.message,
      })),
    });
  }

  return result.data;
}

function customerNotFound() {
  return new ApiError(
    404,
    "CUSTOMER_NOT_FOUND",
    "The customer does not exist.",
  );
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/clientes/[id]">,
) {
  try {
    const { id } = await ctx.params;
    const customerId = parseCustomerId(id);
    const data = await parseJsonBody(request, updateCustomerSchema);

    try {
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: normalizeCustomerData(data),
      });

      return Response.json({ data: customer }, { status: 200 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw customerNotFound();
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/clientes/[id]">,
) {
  try {
    const { id } = await ctx.params;
    const customerId = parseCustomerId(id);

    try {
      await prisma.customer.delete({ where: { id: customerId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw customerNotFound();
      }

      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
