import type { Prisma } from "@/src/generated/prisma/client";

import { handleApiError } from "@/src/lib/api/errors";
import { cancellationInvoiceData } from "@/src/lib/api/invoice";
import { requireSession } from "@/src/lib/api/session";
import {
  parseSaleId,
  SALE_INCLUDE,
  saleAlreadyCancelled,
  saleNotFound,
} from "@/src/lib/api/sale";
import { recordMovement } from "@/src/lib/kardex/engine";
import { prisma } from "@/src/lib/prisma";
import { sendNubefactCancellation } from "@/src/lib/nubefact";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/ventas/[id]/anular">,
) {
  try {
    const user = await requireSession(request, { adminOnly: true });

    const { id } = await ctx.params;
    const saleId = parseSaleId(id);

    const existing = await prisma.sale.findUnique({
      where: { id: saleId },
      include: SALE_INCLUDE,
    });

    if (!existing) {
      throw saleNotFound();
    }

    // Respuesta rápida para el caso habitual. La comprobación que de verdad
    // protege el stock es la de la transacción, más abajo.
    if (existing.status === "ANULADA") {
      throw saleAlreadyCancelled();
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

      cancelledInvoiceData = cancellationInvoiceData(response);
    } else if (existing.invoice) {
      // Un comprobante pendiente nunca llegó a SUNAT: solo se marca anulado.
      cancelledInvoiceData = { status: "ANULADO", errorMessage: null };
    }

    const sale = await prisma.$transaction(async (tx) => {
      // El cambio de estado es condicional: de dos anulaciones simultáneas,
      // solo una encuentra la venta COMPLETADA. La otra no afecta ninguna
      // fila y se detiene aquí, antes de reponer el stock por segunda vez.
      const claimed = await tx.sale.updateMany({
        where: { id: saleId, status: "COMPLETADA" },
        data: { status: "ANULADA" },
      });

      if (claimed.count === 0) {
        throw saleAlreadyCancelled();
      }

      // Cada salida de la venta vuelve al kárdex como entrada, al mismo costo
      // con que salió (no al promedio actual). Las ventas anteriores al
      // kárdex no tienen salida: entran al promedio vigente.
      const exits = await tx.stockMovement.findMany({
        where: { referenceType: "SALE", referenceId: saleId, type: "VENTA" },
        select: { id: true, productId: true, unitCost: true },
      });
      const exitByProduct = new Map(exits.map((exit) => [exit.productId, exit]));

      const returned = new Map<string, number>();
      for (const item of existing.items) {
        // Un producto borrado antes del kárdex ya no puede recibir stock.
        if (!item.productId) continue;
        returned.set(
          item.productId,
          (returned.get(item.productId) ?? 0) + item.quantity,
        );
      }

      for (const productId of [...returned.keys()].sort()) {
        const exit = exitByProduct.get(productId);

        await recordMovement(tx, {
          productId,
          type: "ANULACION_VENTA",
          quantity: returned.get(productId)!,
          unitCost: exit?.unitCost ?? null,
          referenceType: "SALE_CANCELLATION",
          referenceId: saleId,
          reversesMovementId: exit?.id ?? null,
          document: existing.invoice
            ? {
                type: existing.invoice.documentType === "FACTURA" ? "01" : "03",
                series: existing.invoice.series,
                number: existing.invoice.number,
              }
            : undefined,
          reason: `Anulación de la venta #${existing.number}`,
          userId: user.id,
        });
      }

      if (existing.invoice && cancelledInvoiceData) {
        await tx.invoice.update({
          where: { id: existing.invoice.id },
          data: cancelledInvoiceData,
        });
      }

      return tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: SALE_INCLUDE,
      });
    });

    return Response.json({ data: sale }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
