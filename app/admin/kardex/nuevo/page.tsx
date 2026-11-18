import type { Metadata } from "next";
import { Suspense } from "react";

import MovementFormLoader from "@/components/kardex/MovementFormLoader";
import PageHeader from "@/components/ui/PageHeader";
import PageSkeleton from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Registrar movimiento",
};

export default function NuevoMovimientoPage() {
  return (
    <>
      <PageHeader
        title="Registrar movimiento"
        description="Ingresos de mercadería, ajustes de inventario, mermas y ajustes de valorización. Las ventas y anulaciones se registran solas."
      />
      <Suspense fallback={<PageSkeleton />}>
        <MovementFormLoader />
      </Suspense>
    </>
  );
}
