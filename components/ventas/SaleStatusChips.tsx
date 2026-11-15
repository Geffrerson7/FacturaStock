"use client";

import { Chip } from "@heroui/react";

import type { InvoiceStatus, SaleStatus } from "@/src/lib/types/sale";

type ChipColor = "success" | "warning" | "danger" | "default";

export const INVOICE_STATUS: Record<
  InvoiceStatus,
  { label: string; color: ChipColor }
> = {
  EMITIDO: { label: "Emitido", color: "success" },
  PENDIENTE: { label: "Pendiente", color: "warning" },
  ANULADO: { label: "Anulado", color: "danger" },
  ANULACION_PENDIENTE: { label: "Anulación pendiente", color: "default" },
};

export function SaleStatusChip({ status }: { status: SaleStatus }) {
  const isCompleted = status === "COMPLETADA";

  return (
    <Chip color={isCompleted ? "success" : "danger"} size="sm" variant="soft">
      <Chip.Label>{isCompleted ? "Completada" : "Anulada"}</Chip.Label>
    </Chip>
  );
}

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const { label, color } = INVOICE_STATUS[status];

  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
