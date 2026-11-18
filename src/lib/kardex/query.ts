/**
 * Lectura del kárdex de un producto en un rango de fechas: saldo anterior,
 * movimientos, totales del periodo y saldo final. Lo usan la pantalla y la
 * exportación a Excel, así las dos muestran siempre lo mismo.
 */

import type { Prisma } from "@/src/generated/prisma/client";
import { ApiError } from "@/src/lib/api/errors";
import {
  addDays,
  limaDateKey,
  limaMidnight,
  startOfLimaMonth,
} from "@/src/lib/lima-time";
import { prisma } from "@/src/lib/prisma";
import type {
  KardexBalanceDto,
  KardexReport,
  KardexTotals,
} from "@/src/lib/types/kardex";

import { toDecimal } from "./calc";
import type { StockMovementTypeKey } from "./catalog";

/** Tope de filas de una exportación: un año de un producto muy vendido. */
export const MAX_EXPORT_ROWS = 20000;

export type KardexRange = {
  /** AAAA-MM-DD, inclusive. */
  from: string;
  /** AAAA-MM-DD, inclusive. */
  to: string;
  start: Date;
  /** Medianoche del día siguiente a `to` (exclusivo). */
  end: Date;
};

/** Rango del kárdex; por defecto, el mes en curso hasta hoy (hora de Lima). */
export function resolveKardexRange(
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): KardexRange {
  const resolvedFrom = from ?? limaDateKey(startOfLimaMonth(now));
  const resolvedTo = to ?? limaDateKey(now);

  if (resolvedFrom > resolvedTo) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La fecha inicial no puede ser posterior a la final.",
      { field: "from" },
    );
  }

  return {
    from: resolvedFrom,
    to: resolvedTo,
    start: limaMidnight(resolvedFrom),
    end: addDays(limaMidnight(resolvedTo), 1),
  };
}

export const MOVEMENT_SELECT = {
  id: true,
  sequence: true,
  type: true,
  direction: true,
  sunatOperationCode: true,
  quantity: true,
  unitCost: true,
  totalCost: true,
  balanceQuantity: true,
  balanceAverageCost: true,
  balanceValue: true,
  documentType: true,
  documentSeries: true,
  documentNumber: true,
  referenceType: true,
  referenceId: true,
  reason: true,
  occurredAt: true,
  user: { select: { name: true } },
} satisfies Prisma.StockMovementSelect;

const BALANCE_SELECT = {
  balanceQuantity: true,
  balanceAverageCost: true,
  balanceValue: true,
} satisfies Prisma.StockMovementSelect;

type BalanceRow = Prisma.StockMovementGetPayload<{
  select: typeof BALANCE_SELECT;
}>;

function toBalance(row: BalanceRow | null): KardexBalanceDto {
  return row
    ? {
        quantity: row.balanceQuantity,
        averageCost: row.balanceAverageCost.toString(),
        value: row.balanceValue.toString(),
      }
    : { quantity: 0, averageCost: "0", value: "0" };
}

type DirectionSum = {
  direction: "ENTRADA" | "SALIDA" | "NINGUNA";
  _sum: { quantity: number | null; totalCost: Prisma.Decimal | null };
};

/**
 * Totales del periodo. Un ajuste de valorización no mueve unidades: su
 * importe neto suma a las entradas si sube el valor o a las salidas si lo
 * baja, igual que en el Excel.
 */
export function summarizeTotals(groups: DirectionSum[]): KardexTotals {
  let entriesQuantity = 0;
  let exitsQuantity = 0;
  let entriesValue = toDecimal(0);
  let exitsValue = toDecimal(0);

  for (const group of groups) {
    const quantity = group._sum.quantity ?? 0;
    const value = toDecimal(group._sum.totalCost);

    if (group.direction === "ENTRADA") {
      entriesQuantity += quantity;
      entriesValue = entriesValue.add(value);
    } else if (group.direction === "SALIDA") {
      exitsQuantity += quantity;
      exitsValue = exitsValue.add(value);
    } else if (value.isNegative()) {
      exitsValue = exitsValue.add(value.abs());
    } else {
      entriesValue = entriesValue.add(value);
    }
  }

  return {
    entries: { quantity: entriesQuantity, value: entriesValue.toFixed(2) },
    exits: { quantity: exitsQuantity, value: exitsValue.toFixed(2) },
  };
}

export type KardexReportOptions = {
  productId: string;
  from?: string;
  to?: string;
  type?: StockMovementTypeKey;
  /** Sin paginación devuelve todo el rango (exportación), hasta el tope. */
  page?: number;
  pageSize?: number;
  now?: Date;
};

export async function getKardexReport(options: KardexReportOptions): Promise<{
  report: KardexReport;
  total: number;
}> {
  const range = resolveKardexRange(options.from, options.to, options.now);

  const product = await prisma.product.findUnique({
    where: { id: options.productId },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      lastCost: true,
      averageCost: true,
      inventoryValue: true,
      isActive: true,
    },
  });

  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "El producto no existe.");
  }

  const productWhere = { productId: product.id };
  const where: Prisma.StockMovementWhereInput = {
    ...productWhere,
    occurredAt: { gte: range.start, lt: range.end },
    ...(options.type ? { type: options.type } : {}),
  };
  const page =
    options.page !== undefined && options.pageSize !== undefined
      ? {
          skip: (options.page - 1) * options.pageSize,
          take: options.pageSize,
        }
      : { skip: 0, take: MAX_EXPORT_ROWS };

  const [opening, closing, movements, total, groups, firstMovements] =
    await Promise.all([
      prisma.stockMovement.findFirst({
        where: { ...productWhere, occurredAt: { lt: range.start } },
        orderBy: { sequence: "desc" },
        select: BALANCE_SELECT,
      }),
      prisma.stockMovement.findFirst({
        where: { ...productWhere, occurredAt: { lt: range.end } },
        orderBy: { sequence: "desc" },
        select: BALANCE_SELECT,
      }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { sequence: "asc" },
        select: MOVEMENT_SELECT,
        ...page,
      }),
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.groupBy({
        by: ["direction"],
        where,
        _sum: { quantity: true, totalCost: true },
      }),
      prisma.stockMovement.findMany({
        where: productWhere,
        orderBy: { sequence: "asc" },
        take: 2,
        select: { type: true },
      }),
    ]);

  return {
    total,
    report: {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        lastCost: product.lastCost.toString(),
        averageCost: product.averageCost.toString(),
        inventoryValue: product.inventoryValue.toString(),
        isActive: product.isActive,
      },
      range: { from: range.from, to: range.to },
      opening: toBalance(opening),
      closing: toBalance(closing),
      totals: summarizeTotals(groups as DirectionSum[]),
      canEditInitialCost:
        firstMovements.length === 1 &&
        firstMovements[0].type === "SALDO_INICIAL",
      movements: movements.map((movement) => ({
        ...movement,
        unitCost: movement.unitCost.toString(),
        totalCost: movement.totalCost.toString(),
        balanceAverageCost: movement.balanceAverageCost.toString(),
        balanceValue: movement.balanceValue.toString(),
        occurredAt: movement.occurredAt.toISOString(),
      })),
    },
  };
}
