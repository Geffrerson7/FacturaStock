import type { Metadata } from "next";

import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de ventas, comprobantes y stock de tu tienda."
      />
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
        Los indicadores de ventas y stock estarán disponibles próximamente.
      </p>
    </>
  );
}
