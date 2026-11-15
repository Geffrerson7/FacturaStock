import { toast } from "@heroui/react";

import { formatInvoiceCode } from "@/src/lib/format";
import type { Sale } from "@/src/lib/types/sale";

/**
 * Acciones sobre una venta ya registrada. Cada una llama a la API, muestra el
 * aviso correspondiente y devuelve `true` si la venta cambió (para recargar
 * la tabla o la página de detalle).
 */

type SaleRef = Pick<Sale, "id" | "number">;

type SaleResponsePayload = {
  data?: Sale;
  error?: { message?: string };
};

async function postSaleAction(
  url: string,
  fallbackMessage: string,
): Promise<Sale | undefined> {
  const response = await fetch(url, { method: "POST" });
  const payload = (await response
    .json()
    .catch(() => null)) as SaleResponsePayload | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? fallbackMessage);
  }

  return payload?.data;
}

function errorDescription(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export async function cancelSale(sale: SaleRef): Promise<boolean> {
  try {
    await postSaleAction(
      `/api/ventas/${sale.id}/anular`,
      "No se pudo anular la venta.",
    );

    toast.success("Venta anulada", {
      description: `La venta #${sale.number} se anuló y el stock fue devuelto.`,
    });
    return true;
  } catch (error) {
    toast.danger("No se pudo anular la venta", {
      description: errorDescription(error),
    });
    return false;
  }
}

export async function retryInvoice(sale: SaleRef): Promise<boolean> {
  try {
    const updated = await postSaleAction(
      `/api/ventas/${sale.id}/comprobante`,
      "No se pudo emitir el comprobante.",
    );
    const invoice = updated?.invoice;

    if (invoice?.status === "EMITIDO") {
      toast.success("Comprobante emitido", {
        description: `Se emitió ${formatInvoiceCode(invoice)} correctamente.`,
      });
    } else {
      toast.warning("Comprobante pendiente", {
        description:
          invoice?.errorMessage ??
          "Nubefact no confirmó la emisión. Revisa la configuración y reintenta.",
      });
    }
    return true;
  } catch (error) {
    toast.danger("No se pudo emitir el comprobante", {
      description: errorDescription(error),
    });
    return false;
  }
}

export async function refreshCancellation(sale: SaleRef): Promise<boolean> {
  try {
    const updated = await postSaleAction(
      `/api/ventas/${sale.id}/anulacion`,
      "No se pudo consultar el estado de la anulación.",
    );
    const invoice = updated?.invoice;

    if (invoice?.status === "ANULADO") {
      toast.success("Anulación aceptada", {
        description: `SUNAT aceptó la anulación de ${formatInvoiceCode(invoice)}.`,
      });
    } else {
      toast.warning("La anulación sigue pendiente", {
        description:
          invoice?.sunatDescription ??
          "SUNAT todavía no procesa la anulación. Vuelve a consultar más tarde.",
      });
    }
    return true;
  } catch (error) {
    toast.danger("No se pudo actualizar el estado", {
      description: errorDescription(error),
    });
    return false;
  }
}
