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

            <Modal.Body className="flex flex-col gap-3 text-sm text-slate-600">
              <p>
                ¿Seguro que deseas eliminar{" "}
                <span className="font-medium text-slate-900">
                  {category?.name ?? ""}
                </span>
                ?
              </p>

              {hasProducts ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  Esta categoría tiene {category?.productCount}{" "}
                  {category?.productCount === 1 ? "producto asignado" : "productos asignados"}
                  . Reasígnalos a otra categoría antes de eliminarla.
                </p>
              ) : (
                <p className="text-red-600">
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
