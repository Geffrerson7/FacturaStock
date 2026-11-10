import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { emitSaleInvoice } from "@/src/lib/api/invoice";
import { parseSaleId, SALE_INCLUDE } from "@/src/lib/api/sale";
import { prisma } from "@/src/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/ventas/[id]/comprobante">,
) {
  try {
    const { id } = await ctx.params;
    const saleId = parseSaleId(id);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new ApiError(404, "SALE_NOT_FOUND", "The sale does not exist.");
    }

    if (sale.status === "ANULADA") {
      throw new ApiError(
        409,
        "SALE_ALREADY_CANCELLED",
        "The sale has already been cancelled.",
      );
    }

    if (!sale.invoice) {
      throw new ApiError(
        404,
        "INVOICE_NOT_FOUND",
        "The sale does not have an invoice.",
      );
    }

    if (sale.invoice.status === "EMITIDO") {
      throw new ApiError(
        409,
        "INVOICE_ALREADY_EMITTED",
        "The invoice has already been emitted.",
      );
    }

    if (sale.invoice.status !== "PENDIENTE") {
      throw new ApiError(
        409,
        "INVOICE_NOT_PENDING",
        "The invoice cannot be emitted in its current state.",
      );
    }

    const result = await emitSaleInvoice(sale);

    return Response.json(
      {
        data: result.sale,
        ...(result.error ? { error: { message: result.error } } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
