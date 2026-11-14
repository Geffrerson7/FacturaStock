import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { cancellationInvoiceData } from "@/src/lib/api/invoice";
import { requireSession } from "@/src/lib/api/session";
import { parseSaleId, SALE_INCLUDE, saleNotFound } from "@/src/lib/api/sale";
import { prisma } from "@/src/lib/prisma";
import { consultNubefactCancellation } from "@/src/lib/nubefact";

/**
 * Actualiza el estado de una anulación pendiente.
 *
 * POST /api/ventas/:id/anulacion
 *
 * SUNAT procesa las comunicaciones de baja de forma asíncrona, así que al
 * anular una venta el comprobante puede quedar en ANULACION_PENDIENTE. Este
 * endpoint consulta el resultado en Nubefact y, si SUNAT ya aceptó la baja,
 * marca el comprobante como ANULADO.
 *
 * Es POST y no GET porque consume la API de Nubefact y modifica el
 * comprobante: el usuario de demostración no puede usarlo.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/ventas/[id]/anulacion">,
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

    if (!sale.invoice) {
      throw new ApiError(
        404,
        "INVOICE_NOT_FOUND",
        "La venta no tiene un comprobante asociado.",
      );
    }

    if (sale.invoice.status !== "ANULACION_PENDIENTE") {
      throw new ApiError(
        409,
        "CANCELLATION_NOT_PENDING",
        "El comprobante no tiene una anulación pendiente.",
      );
    }

    const response = await consultNubefactCancellation({
      invoiceType: sale.invoice.invoiceType,
      series: sale.invoice.series,
      number: sale.invoice.number,
    });

    // Condicional por si otra petición ya resolvió la anulación entretanto.
    await prisma.invoice.updateMany({
      where: { id: sale.invoice.id, status: "ANULACION_PENDIENTE" },
      data: cancellationInvoiceData(response),
    });

    const updated = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: SALE_INCLUDE,
    });

    return Response.json({ data: updated }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
