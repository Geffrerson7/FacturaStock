"use client";

import { useSearchParams } from "next/navigation";

import MovementForm from "@/components/kardex/MovementForm";

/** Lee el producto de la URL (?productId=) y lo pasa al formulario. */
export default function MovementFormLoader() {
  const productId = useSearchParams().get("productId") ?? undefined;

  return <MovementForm key={productId} initialProductId={productId} />;
}
