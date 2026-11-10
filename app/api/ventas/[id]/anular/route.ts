import type { Prisma } from "@/src/generated/prisma/client";

import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { parseSaleId, SALE_INCLUDE } from "@/src/lib/api/sale";
import { prisma } from "@/src/lib/prisma";
import {
  mapNubefactInvoice,
  sendNubefactCancellation,
} from "@/src/lib/nubefact";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/ventas/[id]/anular">,
) {
  try {
    const { id } = await ctx.params;
    const saleId = parseSaleId(id);

    const existing = await prisma.sale.findUnique({
      where: { id: saleId },
      include: SALE_INCLUDE,
    });

    if (!existing) {
      throw new ApiError(404, "SALE_NOT_FOUND", "The sale does not exist.");
    }

    if (existing.status === "ANULADA") {
      throw new ApiError(
        409,
        "SALE_ALREADY_CANCELLED",
        "The sale has already been cancelled.",
      );
    }

    let cancelledInvoiceData: Prisma.InvoiceUpdateInput | null = null;

    if (existing.invoice?.status === "EMITIDO") {
      // Primero se anula en Nubefact; si falla, la venta no se anula localmente.
      const response = await sendNubefactCancellation({
        operacion: "generar_anulacion",
        tipo_de_comprobante: existing.invoice.invoiceType,
        serie: existing.invoice.series,
        numero: existing.invoice.number,
        motivo: "ANULACION DE VENTA",
      });
      const mapped = mapNubefactInvoice(response);

      cancelledInvoiceData = {
        status:
          response.aceptada_por_sunat === true
            ? "ANULADO"
            : "ANULACION_PENDIENTE",
        sunatAccepted:
          typeof response.aceptada_por_sunat === "boolean"
            ? response.aceptada_por_sunat
            : null,
        sunatDescription: mapped.sunatDescription,
        sunatNote: mapped.sunatNote,
        sunatResponseCode: mapped.sunatResponseCode,
        pdfUrl: mapped.pdfUrl,
        xmlUrl: mapped.xmlUrl,
        cdrUrl: mapped.cdrUrl,
        errorMessage: null,
        response: mapped.response as Prisma.InputJsonValue,
      };
    } else if (existing.invoice) {
      // Un comprobante pendiente nunca llegó a SUNAT: solo se marca anulado.
      cancelledInvoiceData = { status: "ANULADO", errorMessage: null };
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Devuelve el stock solo de los productos que aún existen.
      for (const item of existing.items) {
        if (!item.productId) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      if (existing.invoice && cancelledInvoiceData) {
        await tx.invoice.update({
          where: { id: existing.invoice.id },
          data: cancelledInvoiceData,
        });
      }

      return tx.sale.update({
        where: { id: saleId },
        data: { status: "ANULADA" },
        include: SALE_INCLUDE,
      });
    });

    return Response.json({ data: sale }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
