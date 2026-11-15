"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { FiRefreshCw, FiXCircle } from "react-icons/fi";

import CancelSaleDialog from "@/components/ventas/CancelSaleDialog";
import {
  cancelSale,
  refreshCancellation,
  retryInvoice,
} from "@/components/ventas/sale-actions";
import type { InvoiceStatus, SaleStatus } from "@/src/lib/types/sale";

type SaleActionsProps = {
  sale: {
    id: string;
    number: number;
    total: string;
    status: SaleStatus;
    invoiceStatus: InvoiceStatus | null;
  };
};

type PendingAction = "cancel" | "retry" | "refresh" | null;

/** Botones del detalle de una venta. Tras cada acción se recarga la página. */
export default function SaleActions({ sale }: SaleActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  async function run(action: Exclude<PendingAction, null>) {
    setPending(action);

    const changed =
      action === "cancel"
        ? await cancelSale(sale)
        : action === "retry"
          ? await retryInvoice(sale)
          : await refreshCancellation(sale);

    if (changed) {
      setIsCancelDialogOpen(false);
      router.refresh();
    }
    setPending(null);
  }

  const isCompleted = sale.status === "COMPLETADA";
  const canRetry = isCompleted && sale.invoiceStatus === "PENDIENTE";
  const canRefresh = sale.invoiceStatus === "ANULACION_PENDIENTE";

  if (!isCompleted && !canRefresh) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRetry ? (
        <Button
          variant="outline"
          isPending={pending === "retry"}
          isDisabled={pending !== null}
          onPress={() => void run("retry")}
        >
          <FiRefreshCw aria-hidden />
          Reintentar comprobante
        </Button>
      ) : null}

      {canRefresh ? (
        <Button
          variant="outline"
          isPending={pending === "refresh"}
          isDisabled={pending !== null}
          onPress={() => void run("refresh")}
        >
          <FiRefreshCw aria-hidden />
          Actualizar estado de la anulación
        </Button>
      ) : null}

      {isCompleted ? (
        <Button
          variant="danger-soft"
          isDisabled={pending !== null}
          onPress={() => setIsCancelDialogOpen(true)}
        >
          <FiXCircle aria-hidden />
          Anular venta
        </Button>
      ) : null}

      <CancelSaleDialog
        sale={sale}
        isOpen={isCancelDialogOpen}
        isCancelling={pending === "cancel"}
        onCancel={() => setIsCancelDialogOpen(false)}
        onConfirm={() => void run("cancel")}
      />
    </div>
  );
}
