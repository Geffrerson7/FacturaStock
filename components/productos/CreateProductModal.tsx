"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { FiPlus } from "react-icons/fi";

import ProductForm from "@/components/productos/ProductForm";
import type { Category } from "@/src/lib/types/category";
import type { Product } from "@/src/lib/types/product";

type CreateProductModalProps = {
  categories: Category[];
  onCreated: (product: Product) => void;
};

export default function CreateProductModal({
  categories,
  onCreated,
}: CreateProductModalProps) {
  const state = useOverlayState();

  return (
    <Modal state={state}>
      <Button
        className="bg-black text-white"
        variant="primary"
        isDisabled={categories.length === 0}
        onPress={state.open}
      >
        <FiPlus aria-hidden />
        Nuevo producto
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Registrar producto</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <ProductForm
                categories={categories}
                onSuccess={(product) => {
                  onCreated(product);
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
