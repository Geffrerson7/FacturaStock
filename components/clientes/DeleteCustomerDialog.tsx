"use client";

import { Button, Modal, Spinner, useOverlayState } from "@heroui/react";
import { FiTrash2 } from "react-icons/fi";

import { getCustomerDocument, getCustomerName } from "@/src/lib/customer";
import type { Customer } from "@/src/lib/types/customer";

type DeleteCustomerDialogProps = {
  customer: Customer | null;
  isOpen: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteCustomerDialog({
  customer,
  isOpen,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteCustomerDialogProps) {
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
              <Modal.Heading>Eliminar cliente</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3 text-sm text-slate-600">
              <p>
                ¿Seguro que deseas eliminar a{" "}
                <span className="font-medium text-slate-900">
                  {customer ? getCustomerName(customer) : ""}
                </span>
                ?
              </p>
              <p>
                {customer?.documentType ?? "Documento"}:{" "}
                <span className="font-medium text-slate-900">
                  {customer ? getCustomerDocument(customer) : "—"}
                </span>
              </p>
              <p className="text-red-600">
                Esta acción no se puede deshacer.
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
