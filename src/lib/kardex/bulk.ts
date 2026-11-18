/**
 * Escritura en bloque del kárdex de un producto, para cargas de datos (la
 * demo, una importación). Reemplaza todos sus movimientos por una lista ya
 * ordenada y deja el producto con el saldo final. Los saldos se calculan con
 * las mismas reglas que `recordMovement`.
 */

import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";

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

/**
 * Tiempo máximo de una carga en bloque. El límite por defecto de Prisma
 * (5 s) no alcanza contra una base remota como Neon.
 */
export const BULK_TRANSACTION_TIMEOUT_MS = 60_000;

/**
 * Reemplaza el kárdex de varios productos en una sola transacción y con
 * pocas consultas, sin importar cuántos productos sean: un borrado, una
 * inserción con todas las filas y una actualización de los saldos.
 */
export async function replaceKardexBulk(
  db: PrismaClient,
  items: { productId: string; movements: BulkMovement[] }[],
): Promise<void> {
  if (items.length === 0) return;

  const built = items.map(({ productId, movements }) => ({
    productId,
    ...buildKardexRows(productId, movements),
  }));
  const rows = built.flatMap((item) => item.rows);

  await db.$transaction(
    async (tx) => {
      await tx.stockMovement.deleteMany({
        where: { productId: { in: built.map((item) => item.productId) } },
      });

      if (rows.length > 0) {
        await tx.stockMovement.createMany({ data: rows });
      }

      // Un solo UPDATE ... FROM (VALUES ...) para el saldo de todos los productos.
      const values = Prisma.join(
        built.map(
          ({ productId, product }) =>
            Prisma.sql`(${productId}::uuid, ${product.stock}::int, ${product.averageCost.toString()}::numeric, ${product.inventoryValue.toString()}::numeric, ${product.lastCost.toString()}::numeric)`,
        ),
      );

      await tx.$executeRaw`
        UPDATE "products" AS p
        SET "stock" = v.stock,
            "average_cost" = v.average_cost,
            "inventory_value" = v.inventory_value,
            "last_cost" = v.last_cost,
            "updated_at" = NOW()
        FROM (VALUES ${values}) AS v(id, stock, average_cost, inventory_value, last_cost)
        WHERE p."id" = v.id
      `;
    },
    { timeout: BULK_TRANSACTION_TIMEOUT_MS, maxWait: 10_000 },
  );
}
