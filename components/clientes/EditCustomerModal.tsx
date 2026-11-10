"use client";

import { Modal, useOverlayState } from "@heroui/react";

import CustomerForm from "@/components/clientes/CustomerForm";
import type { Customer } from "@/src/lib/types/customer";

type EditCustomerModalProps = {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (customer: Customer) => void;
};

export default function EditCustomerModal({
  customer,
  isOpen,
  onClose,
  onUpdated,
}: EditCustomerModalProps) {
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
              <Modal.Heading>Editar cliente</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              {customer ? (
                <CustomerForm
                  key={customer.id}
                  customer={customer}
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
