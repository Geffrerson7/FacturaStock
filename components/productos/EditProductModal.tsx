"use client";

import { Modal, useOverlayState } from "@heroui/react";

import ProductForm from "@/components/productos/ProductForm";
import type { Category } from "@/src/lib/types/category";
import type { Product } from "@/src/lib/types/product";

type EditProductModalProps = {
  product: Product | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (product: Product) => void;
};

export default function EditProductModal({
  product,
  categories,
  isOpen,
  onClose,
  onUpdated,
}: EditProductModalProps) {
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
              <Modal.Heading>Editar producto</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              {product ? (
                <ProductForm
                  key={product.id}
                  product={product}
                  categories={categories}
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
