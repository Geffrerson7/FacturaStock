import SalesTable from "@/components/ventas/SalesTable";

export default function VentasPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Ventas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Registra ventas, revisa su detalle y anula operaciones cuando sea
          necesario.
        </p>
      </div>
      <SalesTable />
    </main>
  );
}
