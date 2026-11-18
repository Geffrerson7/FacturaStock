import { lowStockWhere } from "@/src/lib/api/product";
import {
  addDays,
  limaDateKey,
  startOfLimaDay,
  startOfLimaMonth,
} from "@/src/lib/lima-time";
import { prisma } from "@/src/lib/prisma";
import { toCents } from "@/src/lib/tax";

/** Días que cubre el gráfico de ventas, incluido hoy. */
export const CHART_DAYS = 30;

const LIST_LIMIT = 5;

export type DailySales = {
  /** AAAA-MM-DD en la hora de Lima. */
  date: string;
  totalCents: number;
  count: number;
};

type Amount = { toString(): string } | number | string;

function amountToCents(value: Amount | null | undefined): number {
  return value === null || value === undefined ? 0 : toCents(Number(value.toString()));
}

/**
 * Agrupa las ventas por día de Lima. Devuelve un elemento por cada día desde
 * `start`, también los días sin ventas, para que el gráfico no salte fechas.
 */
export function bucketSalesByDay(
  sales: { createdAt: Date; total: Amount }[],
  start: Date,
  days: number,
): DailySales[] {
  const buckets = new Map<string, DailySales>();

  for (let index = 0; index < days; index += 1) {
    const date = limaDateKey(addDays(start, index));
    buckets.set(date, { date, totalCents: 0, count: 0 });
  }

  for (const sale of sales) {
    const bucket = buckets.get(limaDateKey(sale.createdAt));
    if (!bucket) continue;

    bucket.totalCents += amountToCents(sale.total);
    bucket.count += 1;
  }

  return [...buckets.values()];
}

/**
 * Indicadores del dashboard. Solo cuentan las ventas COMPLETADAS: una venta
 * anulada devolvió su stock y no es un ingreso.
 */
export async function getDashboardData(now: Date = new Date()) {
  const todayStart = startOfLimaDay(now);
  const monthStart = startOfLimaMonth(now);
  const chartStart = addDays(todayStart, -(CHART_DAYS - 1));
  const completed = { status: "COMPLETADA" } as const;
  const lowStock = { AND: [{ isActive: true }, lowStockWhere()] };

  const [
    today,
    month,
    issuedThisMonth,
    pendingInvoices,
    pendingCancellations,
    lowStockCount,
    lowStockProducts,
    recentSales,
    chartSales,
    inventory,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...completed, createdAt: { gte: todayStart } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { ...completed, createdAt: { gte: monthStart } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.invoice.count({
      where: { status: "EMITIDO", createdAt: { gte: monthStart } },
    }),
    prisma.invoice.count({ where: { status: "PENDIENTE" } }),
    prisma.invoice.count({ where: { status: "ANULACION_PENDIENTE" } }),
    prisma.product.count({ where: lowStock }),
    prisma.product.findMany({
      where: lowStock,
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      take: LIST_LIMIT,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        lowStockThreshold: true,
      },
    }),
    prisma.sale.findMany({
      orderBy: [{ createdAt: "desc" }, { number: "desc" }],
      take: LIST_LIMIT,
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        createdAt: true,
        customer: true,
        invoice: { select: { series: true, number: true, status: true } },
      },
    }),
    prisma.sale.findMany({
      where: { ...completed, createdAt: { gte: chartStart } },
      select: { createdAt: true, total: true },
    }),
    // Valor del inventario según el kárdex (costo promedio), de todos los
    // productos: uno inactivo sigue ocupando el almacén.
    prisma.product.aggregate({
      _sum: { inventoryValue: true, stock: true },
    }),
  ]);

  return {
    today: {
      totalCents: amountToCents(today._sum.total),
      count: today._count._all,
    },
    month: {
      totalCents: amountToCents(month._sum.total),
      count: month._count._all,
    },
    invoices: {
      issuedThisMonth,
      pending: pendingInvoices,
      pendingCancellations,
    },
    lowStock: { count: lowStockCount, products: lowStockProducts },
    inventory: {
      valueCents: amountToCents(inventory._sum.inventoryValue),
      units: inventory._sum.stock ?? 0,
    },
    recentSales,
    salesByDay: bucketSalesByDay(chartSales, chartStart, CHART_DAYS),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
