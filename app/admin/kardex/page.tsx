import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@heroui/styles";
import { FiPlus } from "react-icons/fi";

import KardexView from "@/components/kardex/KardexView";
import PageHeader from "@/components/ui/PageHeader";
import PageSkeleton from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Kárdex",
};

export default function KardexPage() {
  return (
    <>
      <PageHeader
        title="Kárdex"
        description="Entradas, salidas y saldo de cada producto, en unidades y valorizado por costo promedio."
        actions={
          <Link
            href="/admin/kardex/nuevo"
            className={buttonVariants({ variant: "primary" })}
          >
            <FiPlus aria-hidden />
            Registrar movimiento
          </Link>
        }
      />
      {/* El producto elegido viaja en la URL (?productId=). */}
      <Suspense fallback={<PageSkeleton />}>
        <KardexView />
      </Suspense>
    </>
  );
}
