"use client";

import { Modal, useOverlayState } from "@heroui/react";

import CategoryForm from "@/components/categorias/CategoryForm";
import type { Category } from "@/src/lib/types/category";

type EditCategoryModalProps = {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (category: Category) => void;
};

export default function EditCategoryModal({
  category,
  isOpen,
  onClose,
  onUpdated,
}: EditCategoryModalProps) {
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Editar categoría</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              {category ? (
                <CategoryForm
                  key={category.id}
                  category={category}
                  onSuccess={(updated) => {
                    onUpdated(updated);
                    onClose();
                  }}
                />
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
