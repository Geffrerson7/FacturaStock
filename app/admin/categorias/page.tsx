import CategoriesTable from "@/components/categorias/CategoriesTable";

export default function CategoriasPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Categorías</h2>
        <p className="mt-1 text-sm text-slate-500">
          Administra las categorías del catálogo de tu tienda.
        </p>
      </div>
      <CategoriesTable />
    </main>
  );
}
