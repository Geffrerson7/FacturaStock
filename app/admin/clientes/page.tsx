import type { Metadata } from "next";

import CustomersTable from "@/components/clientes/CustomersTable";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function ClientesPage() {
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Administra los clientes registrados en tu tienda."
      />
      <CustomersTable />
    </>
  );
}
