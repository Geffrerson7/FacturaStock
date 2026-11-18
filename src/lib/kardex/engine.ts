/**
 * Motor del kárdex. Es el único código que escribe `stock`, `averageCost`,
 * `inventoryValue` y `lastCost` de un producto: cualquier entrada o salida
 * pasa por `recordMovement`, dentro de la transacción de quien la origina
 * (una venta, una anulación, un movimiento manual).
 */

import { Prisma } from "@/src/generated/prisma/client";
import { ApiError } from "@/src/lib/api/errors";

import {
  applyMovement,
  InsufficientStockError,
  KardexInputError,
  rebuildMovements,
  toDecimal,
  type DecimalLike,
  type KardexBalance,
  type MovementCalcInput,
} from "./calc";
import {
  sunatOperationCode,
  type StockMovementTypeKey,
  type StockReferenceTypeKey,
} from "./catalog";

type Tx = Prisma.TransactionClient;

export type MovementDocument = {
  /** Tabla 10 de SUNAT: 01 factura, 03 boleta, 00 otros. */
  type: string;
  series?: string | null;
  number?: number | null;
};

export type RecordMovementInput = {
  productId: string;
  type: StockMovementTypeKey;
  /** Unidades, siempre positivas. Se ignora en un ajuste de valorización. */
  quantity: number;
  /**
   * - Saldo inicial e ingreso: el costo que escribió el usuario. Sin valor,
   *   el último costo del producto (o 0).
   * - Anulación de venta: el costo de la salida original. Sin valor, el
   *   promedio vigente.
   * - Ajuste de valorización: el nuevo costo promedio (obligatorio).
   * - Resto: se ignora; se usa el promedio vigente.
   */
  unitCost?: DecimalLike | null;
  referenceType: StockReferenceTypeKey;
  referenceId?: string | null;
  reversesMovementId?: string | null;
  document?: MovementDocument;
  reason?: string | null;
  userId?: string | null;
  occurredAt?: Date;
};

type LockedProduct = {
  name: string;
  stock: number;
  last_cost: DecimalLike;
  average_cost: DecimalLike;
  inventory_value: DecimalLike;
};

/**
 * Bloquea la fila del producto hasta que termine la transacción: dos
 * movimientos del mismo producto se aplican uno detrás de otro, siempre
 * sobre el saldo que dejó el anterior.
 */
async function lockProduct(tx: Tx, productId: string): Promise<LockedProduct> {
  const rows = await tx.$queryRaw<LockedProduct[]>`
    SELECT "name", "stock", "last_cost", "average_cost", "inventory_value"
    FROM "products"
    WHERE "id" = ${productId}::uuid
    FOR UPDATE
  `;

  const product = rows[0];

  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "El producto no existe.");
  }

  return product;
}

function calcInput(
  input: RecordMovementInput,
  product: LockedProduct,
): MovementCalcInput {
  switch (input.type) {
    case "SALDO_INICIAL":
    case "INGRESO":
      return {
        kind: "entry",
        quantity: input.quantity,
        unitCost: input.unitCost ?? product.last_cost,
      };
    case "AJUSTE_POSITIVO":
      return {
        kind: "entry",
        quantity: input.quantity,
        unitCost: product.average_cost,
      };
    case "ANULACION_VENTA":
      return {
        kind: "entry",
        quantity: input.quantity,
        unitCost: input.unitCost ?? product.average_cost,
      };
    case "VENTA":
    case "AJUSTE_NEGATIVO":
    case "MERMA":
      return { kind: "exit", quantity: input.quantity };
    case "AJUSTE_VALORIZACION":
      if (input.unitCost === null || input.unitCost === undefined) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "Indica el nuevo costo unitario del ajuste de valorización.",
          { field: "unitCost" },
        );
      }
      return { kind: "revaluation", unitCost: input.unitCost };
  }
}

/** Registra un movimiento y actualiza el saldo del producto. */
export async function recordMovement(tx: Tx, input: RecordMovementInput) {
  const product = await lockProduct(tx, input.productId);
  const balance: KardexBalance = {
    quantity: product.stock,
    averageCost: toDecimal(product.average_cost),
    value: toDecimal(product.inventory_value),
  };

  let result;

  try {
    result = applyMovement(balance, calcInput(input, product));
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      throw new ApiError(
        409,
        "INSUFFICIENT_STOCK",
        `No hay stock suficiente de "${product.name}". Disponible: ${error.available}, solicitado: ${error.requested}.`,
      );
    }

    if (error instanceof KardexInputError) {
      throw new ApiError(400, "VALIDATION_ERROR", error.message);
    }

    throw error;
  }

  const last = await tx.stockMovement.aggregate({
    where: { productId: input.productId },
    _max: { sequence: true },
  });
  const sequence = (last._max.sequence ?? 0) + 1;

  const movement = await tx.stockMovement.create({
    data: {
      productId: input.productId,
      sequence,
      type: input.type,
      direction: result.direction,
      sunatOperationCode: sunatOperationCode(input.type, input.referenceType),
      quantity: result.quantity,
      unitCost: result.unitCost,
      totalCost: result.totalCost,
      balanceQuantity: result.balance.quantity,
      balanceAverageCost: result.balance.averageCost,
      balanceValue: result.balance.value,
      documentType: input.document?.type ?? "00",
      documentSeries: input.document?.series ?? null,
      documentNumber: input.document?.number ?? null,
      referenceType: input.referenceType,
      referenceId: input.referenceId ?? null,
      reversesMovementId: input.reversesMovementId ?? null,
      reason: input.reason ?? null,
      userId: input.userId ?? null,
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    },
  });

  const updatesLastCost =
    input.type === "INGRESO" || input.type === "SALDO_INICIAL";

  await tx.product.update({
    where: { id: input.productId },
    data: {
      stock: result.balance.quantity,
      averageCost: result.balance.averageCost,
      inventoryValue: result.balance.value,
      ...(updatesLastCost ? { lastCost: result.unitCost } : {}),
    },
  });

  return movement;
}

/**
 * Recalcula todos los saldos de un producto en el orden del correlativo y
 * deja el producto con el saldo del último movimiento. Devuelve cuántas
 * filas cambiaron. Sirve para reparar datos y tras corregir un costo.
 */
export async function rebuildProductKardex(
  tx: Tx,
  productId: string,
): Promise<number> {
  await lockProduct(tx, productId);

  const movements = await tx.stockMovement.findMany({
    where: { productId },
    orderBy: { sequence: "asc" },
  });
  const indexById = new Map(movements.map((m, index) => [m.id, index]));

  const results = rebuildMovements(
    movements.map((movement) => ({
      type: movement.type,
      quantity: movement.quantity,
      unitCost: movement.unitCost,
      reversesIndex: movement.reversesMovementId
        ? indexById.get(movement.reversesMovementId)
        : null,
    })),
  );

  let changed = 0;
  let lastCost: Prisma.Decimal | null = null;

  for (const [index, movement] of movements.entries()) {
    const result = results[index];

    if (movement.type === "INGRESO" || movement.type === "SALDO_INICIAL") {
      lastCost = result.unitCost;
    }

    const isSame =
      toDecimal(movement.unitCost).equals(result.unitCost) &&
      toDecimal(movement.totalCost).equals(result.totalCost) &&
      movement.balanceQuantity === result.balance.quantity &&
      toDecimal(movement.balanceAverageCost).equals(result.balance.averageCost) &&
      toDecimal(movement.balanceValue).equals(result.balance.value);

    if (isSame) continue;

    changed += 1;
    await tx.stockMovement.update({
      where: { id: movement.id },
      data: {
        unitCost: result.unitCost,
        totalCost: result.totalCost,
        balanceQuantity: result.balance.quantity,
        balanceAverageCost: result.balance.averageCost,
        balanceValue: result.balance.value,
      },
    });
  }

  const final = results.at(-1)?.balance;

  await tx.product.update({
    where: { id: productId },
    data: {
      stock: final?.quantity ?? 0,
      averageCost: final?.averageCost ?? 0,
      inventoryValue: final?.value ?? 0,
      ...(lastCost ? { lastCost } : {}),
    },
  });

  return changed;
}
