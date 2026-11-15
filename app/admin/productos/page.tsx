import type { Metadata } from "next";

import ProductsTable from "@/components/productos/ProductsTable";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Productos",
};

export default function ProductosPage() {
  return (
    <>
      <PageHeader
        title="Productos"
        description="Administra el catálogo y el stock de tu tienda."
      />
      <ProductsTable />
    </>
  );
}
