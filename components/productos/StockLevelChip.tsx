"use client";

import { Chip } from "@heroui/react";

import { getStockLevel } from "@/src/lib/stock";

type StockLevelChipProps = {
  product: { stock: number; lowStockThreshold: number };
};

/** Aviso de stock agotado o bajo. Con stock suficiente no muestra nada. */
export default function StockLevelChip({ product }: StockLevelChipProps) {
  const level = getStockLevel(product);

  if (level === "ok") return null;

  return (
    <Chip
      color={level === "out" ? "danger" : "warning"}
      size="sm"
      variant="soft"
    >
      <Chip.Label>{level === "out" ? "Agotado" : "Stock bajo"}</Chip.Label>
    </Chip>
  );
}
