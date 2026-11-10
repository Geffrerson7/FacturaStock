import CustomersTable from "@/components/clientes/CustomersTable";

export default function ClientesPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Clientes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Administra los clientes registrados en tu tienda.
        </p>
      </div>
      <CustomersTable />
    </main>
  );
}
