"use client";

import { Button, Modal, Spinner, useOverlayState } from "@heroui/react";
import { FiTrash2 } from "react-icons/fi";

import type { Product } from "@/src/lib/types/product";
import { formatCurrency } from "@/src/lib/format";

type DeleteProductDialogProps = {
  product: Product | null;
  isOpen: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteProductDialog({
  product,
  isOpen,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteProductDialogProps) {
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onCancel();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop
        isDismissable={!isDeleting}
        isKeyboardDismissDisabled={isDeleting}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Eliminar producto</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3 text-sm text-slate-600">
              <p>
                ¿Seguro que deseas eliminar{" "}
                <span className="font-medium text-slate-900">
                  {product?.name}
                </span>
                ?
              </p>
              <p>
                SKU:{" "}
                <span className="font-medium text-slate-900">
                  {product?.sku}
                </span>{" "}
                · Precio: {product ? formatCurrency(product.price) : "—"}
              </p>
              <p className="text-red-600">
                Esta acción no se puede deshacer. Las ventas ya registradas
                conservan su historial.
              </p>
            </Modal.Body>

            <Modal.Footer>
              <Button
                variant="secondary"
                isDisabled={isDeleting}
                onPress={onCancel}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                isDisabled={isDeleting}
                onPress={onConfirm}
              >
                {isDeleting ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  <FiTrash2 aria-hidden />
                )}
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
