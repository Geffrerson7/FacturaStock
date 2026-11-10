"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { FiPlus } from "react-icons/fi";

import CustomerForm from "@/components/clientes/CustomerForm";
import type { Customer } from "@/src/lib/types/customer";

type CreateCustomerModalProps = {
  onCreated: (customer: Customer) => void;
};

export default function CreateCustomerModal({
  onCreated,
}: CreateCustomerModalProps) {
  const state = useOverlayState();

  return (
    <Modal state={state}>
      <Button
        className="bg-black text-white"
        variant="primary"
        onPress={state.open}
      >
        <FiPlus aria-hidden />
        Nuevo cliente
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Registrar cliente</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <CustomerForm
                onSuccess={(customer) => {
                  onCreated(customer);
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
