"use client";

import { Button, Modal, Spinner, useOverlayState } from "@heroui/react";
import { FiTrash2 } from "react-icons/fi";

import type { CategoryWithCount } from "@/src/lib/types/category";

type DeleteCategoryDialogProps = {
  category: CategoryWithCount | null;
  isOpen: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteCategoryDialog({
  category,
  isOpen,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteCategoryDialogProps) {
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onCancel();
    },
  });

  const hasProducts = (category?.productCount ?? 0) > 0;

  return (
    <Modal state={state}>
      <Modal.Backdrop
        isDismissable={!isDeleting}
        isKeyboardDismissDisabled={isDeleting}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Eliminar categoría</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3 text-sm text-muted">
              <p>
                ¿Seguro que deseas eliminar{" "}
                <span className="font-medium text-foreground">
                  {category?.name ?? ""}
                </span>
                ?
              </p>

              {hasProducts ? (
                <p className="rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
                  Esta categoría tiene {category?.productCount}{" "}
                  {category?.productCount === 1 ? "producto asignado" : "productos asignados"}
                  . Reasígnalos a otra categoría antes de eliminarla.
                </p>
              ) : (
                <p className="text-danger">
                  Esta acción no se puede deshacer.
                </p>
              )}
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
                isDisabled={isDeleting || hasProducts}
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
