import type { Prisma } from "@/src/generated/prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  buildNubefactInvoicePayload,
  consultNubefactInvoice,
  mapNubefactInvoice,
  NubefactError,
  resolveInvoiceIdentity,
  sendNubefactInvoice,
} from "@/src/lib/nubefact";

import type { SaleWithInvoice } from "./sale";

function invoiceDataFromResponse(
  response: ReturnType<typeof mapNubefactInvoice>,
) {
  return {
    sunatAccepted: response.sunatAccepted,
    sunatDescription: response.sunatDescription,
    sunatNote: response.sunatNote,
    sunatResponseCode: response.sunatResponseCode,
    pdfUrl: response.pdfUrl,
    xmlUrl: response.xmlUrl,
    cdrUrl: response.cdrUrl,
    hash: response.hash,
    qrString: response.qrString,
    response: response.response as Prisma.InputJsonValue,
  };
}

/**
 * Emite el comprobante de una venta. No lanza error si Nubefact falla: la
 * venta queda guardada y el comprobante se marca PENDIENTE para reintentar.
 */
export async function emitSaleInvoice(
  sale: SaleWithInvoice,
): Promise<{ sale: SaleWithInvoice; error: string | null }> {
  const invoice = sale.invoice;

  if (!invoice) {
    return { sale, error: "La venta no tiene comprobante asociado." };
  }

  if (invoice.status !== "PENDIENTE") {
    return { sale, error: null };
  }

  try {
    const identity = resolveInvoiceIdentity(sale.customer);
    const payload = buildNubefactInvoicePayload({
      identity,
      number: invoice.number,
      items: sale.items.map((item) => ({
        description: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    });

    const response = await sendNubefactInvoice(payload);
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "EMITIDO",
        issuedAt: new Date(),
        errorMessage: null,
        ...invoiceDataFromResponse(mapNubefactInvoice(response)),
      },
    });

    return { sale: { ...sale, invoice: updated }, error: null };
  } catch (error) {
    // Si el documento ya existe en Nubefact, se consulta para recuperar enlaces.
    if (error instanceof NubefactError && error.code === 23) {
      try {
        const response = await consultNubefactInvoice({
          invoiceType: invoice.invoiceType,
          series: invoice.series,
          number: invoice.number,
        });
        const updated = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "EMITIDO",
            issuedAt: invoice.issuedAt ?? new Date(),
            errorMessage: null,
            ...invoiceDataFromResponse(mapNubefactInvoice(response)),
          },
        });

        return { sale: { ...sale, invoice: updated }, error: null };
      } catch {
        // Si la consulta también falla, se conserva el error original.
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido al emitir el comprobante.";
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PENDIENTE", errorMessage: message },
    });

    return { sale: { ...sale, invoice: updated }, error: message };
  }
}
