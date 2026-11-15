import type { Metadata } from "next";

import SalesTable from "@/components/ventas/SalesTable";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Ventas",
};

export default function VentasPage() {
  return (
    <>
      <PageHeader
        title="Ventas"
        description="Registra ventas, revisa sus comprobantes y anula operaciones cuando sea necesario."
      />
      <SalesTable />
    </>
  );
}
