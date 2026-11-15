import type { Metadata } from "next";

import PageHeader from "@/components/ui/PageHeader";
import SaleForm from "@/components/ventas/SaleForm";

export const metadata: Metadata = {
  title: "Nueva venta",
};

export default function NuevaVentaPage() {
  return (
    <>
      <PageHeader
        title="Nueva venta"
        description="Elige el cliente y los productos. El comprobante se emite al confirmar."
      />
      <SaleForm />
    </>
  );
}
