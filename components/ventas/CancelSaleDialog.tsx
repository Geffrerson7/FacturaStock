"use client";

import { Button, Modal, Spinner, useOverlayState } from "@heroui/react";
import { FiXCircle } from "react-icons/fi";

import { formatCurrency } from "@/src/lib/format";
import type { Sale } from "@/src/lib/types/sale";

type CancelSaleDialogProps = {
  sale: Sale | null;
  isOpen: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function CancelSaleDialog({
  sale,
  isOpen,
  isCancelling,
  onCancel,
  onConfirm,
}: CancelSaleDialogProps) {
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onCancel();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop
        isDismissable={!isCancelling}
        isKeyboardDismissDisabled={isCancelling}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Anular venta</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3 text-sm text-slate-600">
              <p>
                ¿Seguro que deseas anular la venta{" "}
                <span className="font-medium text-slate-900">
                  #{sale?.number}
                </span>
                ?
              </p>
              <p>
                Total:{" "}
                <span className="font-medium text-slate-900">
                  {sale ? formatCurrency(sale.total) : "—"}
                </span>
              </p>
              <p className="text-red-600">
                El stock de los productos volverá al inventario y la venta
                quedará marcada como anulada. Si el comprobante ya fue emitido,
                también se anulará en SUNAT a través de Nubefact.
              </p>
            </Modal.Body>

            <Modal.Footer>
              <Button
                variant="secondary"
                isDisabled={isCancelling}
                onPress={onCancel}
              >
                Volver
              </Button>
              <Button
                variant="danger"
                isDisabled={isCancelling}
                onPress={onConfirm}
              >
                {isCancelling ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  <FiXCircle aria-hidden />
                )}
                {isCancelling ? "Anulando..." : "Anular venta"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
