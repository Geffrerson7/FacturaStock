import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { requireSession } from "@/src/lib/api/session";
import { emitSaleInvoice } from "@/src/lib/api/invoice";
import {
  parseSaleId,
  SALE_INCLUDE,
  saleAlreadyCancelled,
  saleNotFound,
} from "@/src/lib/api/sale";
import { prisma } from "@/src/lib/prisma";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/ventas/[id]/comprobante">,
) {
  try {
    await requireSession(request);

    const { id } = await ctx.params;
    const saleId = parseSaleId(id);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw saleNotFound();
    }

    if (sale.status === "ANULADA") {
      throw saleAlreadyCancelled();
    }

    if (!sale.invoice) {
      throw new ApiError(
        404,
        "INVOICE_NOT_FOUND",
        "La venta no tiene un comprobante asociado.",
      );
    }

    if (sale.invoice.status === "EMITIDO") {
      throw new ApiError(
        409,
        "INVOICE_ALREADY_EMITTED",
        "El comprobante ya fue emitido.",
      );
    }

    if (sale.invoice.status !== "PENDIENTE") {
      throw new ApiError(
        409,
        "INVOICE_NOT_PENDING",
        "El comprobante no se puede emitir en su estado actual.",
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
