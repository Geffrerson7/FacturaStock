import type { Metadata } from "next";

import CategoriesTable from "@/components/categorias/CategoriesTable";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Categorías",
};

export default function CategoriasPage() {
  return (
    <>
      <PageHeader
        title="Categorías"
        description="Administra las categorías del catálogo de tu tienda."
      />
      <CategoriesTable />
    </>
  );
}
