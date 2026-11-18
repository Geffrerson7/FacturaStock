/**
 * Escritura en bloque del kárdex de un producto, para cargas de datos (la
 * demo, una importación). Reemplaza todos sus movimientos por una lista ya
 * ordenada y deja el producto con el saldo final. Los saldos se calculan con
 * las mismas reglas que `recordMovement`.
 */

import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";

import { rebuildMovements, toDecimal, type DecimalLike } from "./calc";
import {
  sunatOperationCode,
  type StockMovementTypeKey,
  type StockReferenceTypeKey,
} from "./catalog";

export type BulkMovement = {
  type: StockMovementTypeKey;
  quantity: number;
  /** Solo en saldo inicial, ingreso y ajuste de valorización. */
  unitCost?: DecimalLike;
  occurredAt: Date;
  referenceType: StockReferenceTypeKey;
  referenceId?: string | null;
  reason?: string | null;
  document?: { type: string; series?: string | null; number?: number | null };
};

/** Filas del kárdex y saldo final del producto. No toca la base. */
export function buildKardexRows(productId: string, movements: BulkMovement[]) {
  const results = rebuildMovements(
    movements.map((movement) => ({
      type: movement.type,
      quantity: movement.quantity,
      unitCost: movement.unitCost ?? 0,
    })),
  );

  let lastCost: Prisma.Decimal | null = null;

  const rows: Prisma.StockMovementCreateManyInput[] = movements.map(
    (movement, index) => {
      const result = results[index];

      if (movement.type === "INGRESO" || movement.type === "SALDO_INICIAL") {
        lastCost = result.unitCost;
      }

      return {
        productId,
        sequence: index + 1,
        type: movement.type,
        direction: result.direction,
        sunatOperationCode: sunatOperationCode(
          movement.type,
          movement.referenceType,
        ),
        quantity: result.quantity,
        unitCost: result.unitCost,
        totalCost: result.totalCost,
        balanceQuantity: result.balance.quantity,
        balanceAverageCost: result.balance.averageCost,
        balanceValue: result.balance.value,
        documentType: movement.document?.type ?? "00",
        documentSeries: movement.document?.series ?? null,
        documentNumber: movement.document?.number ?? null,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId ?? null,
        reason: movement.reason ?? null,
        occurredAt: movement.occurredAt,
        createdAt: movement.occurredAt,
      };
    },
  );

  const final = results.at(-1)?.balance;

  return {
    rows,
    product: {
      stock: final?.quantity ?? 0,
      averageCost: final?.averageCost ?? toDecimal(0),
      inventoryValue: final?.value ?? toDecimal(0),
      lastCost: lastCost ?? toDecimal(0),
    },
  };
}

/** Consultas que reemplazan el kárdex de un producto, para una transacción. */
export function replaceProductKardex(
  db: PrismaClient,
  productId: string,
  movements: BulkMovement[],
) {
  const { rows, product } = buildKardexRows(productId, movements);

  return [
    db.stockMovement.deleteMany({ where: { productId } }),
    db.stockMovement.createMany({ data: rows }),
    db.product.update({ where: { id: productId }, data: product }),
  ];
}
