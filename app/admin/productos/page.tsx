import ProductsTable from "@/components/productos/ProductsTable";

export default function ProductosPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Productos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Administra el catálogo, el stock y las categorías de tu tienda.
        </p>
      </div>
      <ProductsTable />
    </main>
  );
}
