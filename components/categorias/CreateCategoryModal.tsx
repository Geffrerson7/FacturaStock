"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { FiPlus } from "react-icons/fi";

import CategoryForm from "@/components/categorias/CategoryForm";
import type { Category } from "@/src/lib/types/category";

type CreateCategoryModalProps = {
  onCreated: (category: Category) => void;
};

export default function CreateCategoryModal({
  onCreated,
}: CreateCategoryModalProps) {
  const state = useOverlayState();

  return (
    <Modal state={state}>
      <Button
        className="bg-black text-white"
        variant="primary"
        onPress={state.open}
      >
        <FiPlus aria-hidden />
        Nueva categoría
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Registrar categoría</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <CategoryForm
                onSuccess={(category) => {
                  onCreated(category);
                  state.close();
                }}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
