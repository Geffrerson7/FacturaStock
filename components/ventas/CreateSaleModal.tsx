"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { FiPlus } from "react-icons/fi";

import SaleForm from "@/components/ventas/SaleForm";
import type { Customer } from "@/src/lib/types/customer";
import type { Product } from "@/src/lib/types/product";
import type { Sale } from "@/src/lib/types/sale";

type CreateSaleModalProps = {
  products: Product[];
  customers: Customer[];
  onCreated: (sale: Sale) => void;
};

export default function CreateSaleModal({
  products,
  customers,
  onCreated,
}: CreateSaleModalProps) {
  const state = useOverlayState();

  return (
    <Modal state={state}>
      <Button
        className="bg-black text-white"
        variant="primary"
        onPress={state.open}
      >
        <FiPlus aria-hidden />
        Nueva venta
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Registrar venta</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <SaleForm
                products={products}
                customers={customers}
                onSuccess={(sale) => {
                  onCreated(sale);
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
