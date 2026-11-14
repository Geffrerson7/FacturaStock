import { Prisma } from "@/src/generated/prisma/client";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { normalizeCustomerData } from "@/src/lib/api/customer-data";
import { parseJsonBody } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { isWalkInCustomer } from "@/src/lib/customer";
import { prisma } from "@/src/lib/prisma";
import {
  customerIdSchema,
  updateCustomerSchema,
} from "@/src/lib/validations/customer";

function parseCustomerId(id: string) {
  const result = customerIdSchema.safeParse(id);

  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador del cliente no es válido.",
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

function customerNotFound() {
  return new ApiError(404, "CUSTOMER_NOT_FOUND", "El cliente no existe.");
}

/**
 * El cliente walk-in es un registro del sistema: identifica las ventas sin
 * cliente, así que no se puede editar ni eliminar.
 */
async function ensureEditable(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { dni: true },
  });

  if (!customer) {
    throw customerNotFound();
  }

  if (isWalkInCustomer(customer)) {
    throw new ApiError(
      403,
      "WALK_IN_CUSTOMER_PROTECTED",
      "El cliente genérico de ventas sin registro no se puede editar ni eliminar.",
    );
  }
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/clientes/[id]">,
) {
  try {
    await requireSession(request);

    const { id } = await ctx.params;
    const customerId = parseCustomerId(id);
    const data = await parseJsonBody(request, updateCustomerSchema);

    await ensureEditable(customerId);

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
  request: Request,
  ctx: RouteContext<"/api/clientes/[id]">,
) {
  try {
    await requireSession(request);

    const { id } = await ctx.params;
    const customerId = parseCustomerId(id);

    await ensureEditable(customerId);

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
