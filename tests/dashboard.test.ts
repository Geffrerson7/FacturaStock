import { beforeEach, describe, expect, it, vi } from "vitest";

const LOW_STOCK_FIELD = vi.hoisted(() => ({ name: "lowStockThreshold" }));

const db = vi.hoisted(() => ({
  sale: { aggregate: vi.fn(), findMany: vi.fn() },
  invoice: { count: vi.fn() },
  product: {
    count: vi.fn(),
    findMany: vi.fn(),
    fields: { lowStockThreshold: LOW_STOCK_FIELD },
  },
}));

vi.mock("@/src/lib/prisma", () => ({ prisma: db }));

import { niceScale } from "@/components/dashboard/SalesChart";
import { buildProductWhere } from "@/src/lib/api/product";
import {
  bucketSalesByDay,
  CHART_DAYS,
  getDashboardData,
} from "@/src/lib/dashboard";
import { formatInvoiceCode } from "@/src/lib/format";
import {
  limaDateKey,
  startOfLimaDay,
  startOfLimaMonth,
} from "@/src/lib/lima-time";
import { buildNubefactItems } from "@/src/lib/nubefact";
import { getStockLevel } from "@/src/lib/stock";
import { computeSaleTax } from "@/src/lib/tax";
import { createProductSchema } from "@/src/lib/validations/product";

describe("fechas en la hora de Lima", () => {
  it("las 22:00 de Lima siguen siendo el mismo día aunque en UTC ya sea mañana", () => {
    const night = new Date("2026-11-15T03:00:00Z"); // 14/11 22:00 en Lima

    expect(limaDateKey(night)).toBe("2026-11-14");
    expect(startOfLimaDay(night).toISOString()).toBe("2026-11-14T05:00:00.000Z");
  });

  it("el mes empieza a la medianoche de Lima del día 1", () => {
    const date = new Date("2026-12-01T02:00:00Z"); // 30/11 21:00 en Lima

    expect(startOfLimaMonth(date).toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });
});

describe("ventas por día del gráfico", () => {
  const start = new Date("2026-11-10T05:00:00Z"); // 10/11 00:00 en Lima

  it("incluye los días sin ventas y agrupa por día de Lima", () => {
    const days = bucketSalesByDay(
      [
        { createdAt: new Date("2026-11-10T15:00:00Z"), total: "10.10" },
        // 11/11 23:30 en Lima: cuenta para el 11, no para el 12.
        { createdAt: new Date("2026-11-12T04:30:00Z"), total: "0.20" },
        { createdAt: new Date("2026-11-11T12:00:00Z"), total: 0.1 },
      ],
      start,
      3,
    );

    expect(days).toEqual([
      { date: "2026-11-10", totalCents: 1010, count: 1 },
      { date: "2026-11-11", totalCents: 30, count: 2 },
      { date: "2026-11-12", totalCents: 0, count: 0 },
    ]);
  });

  it("ignora las ventas fuera del periodo", () => {
    const days = bucketSalesByDay(
      [{ createdAt: new Date("2026-11-09T12:00:00Z"), total: "99.00" }],
      start,
      2,
    );

    expect(days.every((day) => day.count === 0)).toBe(true);
  });
});

describe("desglose de IGV del punto de venta", () => {
  const cases = [
    [{ quantity: 1, unitPrice: 10 }],
    [{ quantity: 3, unitPrice: 0.99 }],
    [
      { quantity: 1234, unitPrice: 17.33 },
      { quantity: 7, unitPrice: 2.05 },
    ],
  ];

  it.each(cases)("coincide con el comprobante que se envía a Nubefact", (...lines) => {
    const totals = computeSaleTax(lines);
    const invoice = buildNubefactItems(
      lines.map((line) => ({ ...line, description: "Producto" })),
    );

    expect(totals.taxable / 100).toBe(invoice.totalGravada);
    expect(totals.igv / 100).toBe(invoice.totalIgv);
    expect(totals.total / 100).toBe(invoice.total);
    expect(totals.taxable + totals.igv).toBe(totals.total);
  });

  it("una venta vacía suma cero", () => {
    expect(computeSaleTax([])).toEqual({ taxable: 0, igv: 0, total: 0 });
  });
});

describe("umbral de stock bajo", () => {
  it("clasifica el stock según el umbral de cada producto", () => {
    expect(getStockLevel({ stock: 0, lowStockThreshold: 5 })).toBe("out");
    expect(getStockLevel({ stock: 5, lowStockThreshold: 5 })).toBe("low");
    expect(getStockLevel({ stock: 6, lowStockThreshold: 5 })).toBe("ok");
    expect(getStockLevel({ stock: 1, lowStockThreshold: 0 })).toBe("ok");
  });

  it("usa 5 por defecto y no acepta valores negativos", () => {
    const base = {
      name: "Agua",
      sku: "BEB-001",
      price: 2,
      stock: 10,
      categoryId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    };

    expect(createProductSchema.parse(base).lowStockThreshold).toBe(5);
    expect(
      createProductSchema.parse({ ...base, lowStockThreshold: "12" })
        .lowStockThreshold,
    ).toBe(12);
    expect(
      createProductSchema.safeParse({ ...base, lowStockThreshold: -1 }).success,
    ).toBe(false);
  });

  it("el filtro del listado compara el stock con el umbral de la misma fila", () => {
    expect(buildProductWhere({ q: undefined, categoryId: undefined, isActive: undefined, lowStock: true })).toEqual({
      AND: [{ stock: { lte: LOW_STOCK_FIELD } }],
    });
    expect(
      buildProductWhere({ q: undefined, categoryId: undefined, isActive: undefined }),
    ).toEqual({ AND: [] });
  });
});

describe("datos del dashboard", () => {
  const now = new Date("2026-11-15T17:00:00Z"); // 15/11 12:00 en Lima

  beforeEach(() => {
    vi.clearAllMocks();
    db.sale.aggregate
      .mockResolvedValueOnce({ _sum: { total: "120.50" }, _count: { _all: 3 } })
      .mockResolvedValueOnce({ _sum: { total: null }, _count: { _all: 0 } });
    db.invoice.count
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    db.product.count.mockResolvedValue(4);
    db.product.findMany.mockResolvedValue([]);
    db.sale.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { createdAt: new Date("2026-11-15T14:00:00Z"), total: "120.50" },
      ]);
  });

  it("resume ventas de hoy y del mes, comprobantes y stock bajo", async () => {
    const data = await getDashboardData(now);

    expect(data.today).toEqual({ totalCents: 12050, count: 3 });
    expect(data.month).toEqual({ totalCents: 0, count: 0 });
    expect(data.invoices).toEqual({
      issuedThisMonth: 9,
      pending: 2,
      pendingCancellations: 1,
    });
    expect(data.lowStock.count).toBe(4);
    expect(data.salesByDay).toHaveLength(CHART_DAYS);
    expect(data.salesByDay.at(-1)).toEqual({
      date: "2026-11-15",
      totalCents: 12050,
      count: 1,
    });
  });

  it("solo cuenta ventas completadas, desde la medianoche de Lima", async () => {
    await getDashboardData(now);

    expect(db.sale.aggregate.mock.calls[0][0].where).toEqual({
      status: "COMPLETADA",
      createdAt: { gte: new Date("2026-11-15T05:00:00Z") },
    });
    expect(db.sale.aggregate.mock.calls[1][0].where).toEqual({
      status: "COMPLETADA",
      createdAt: { gte: new Date("2026-11-01T05:00:00Z") },
    });
  });

  it("el stock bajo excluye productos inactivos", async () => {
    await getDashboardData(now);

    expect(db.product.count.mock.calls[0][0].where).toEqual({
      AND: [{ isActive: true }, { stock: { lte: LOW_STOCK_FIELD } }],
    });
  });
});

describe("escala del gráfico de ventas", () => {
  it("elige un tope redondo y cercano al máximo", () => {
    expect(niceScale(650)).toEqual({ top: 750, step: 250 });
    expect(niceScale(1400)).toEqual({ top: 1500, step: 500 });
    expect(niceScale(90)).toEqual({ top: 150, step: 50 });
    expect(niceScale(0)).toEqual({ top: 300, step: 100 });
  });

  it("el tope nunca queda por debajo del máximo", () => {
    for (const max of [1, 7.5, 99, 101, 333, 2501, 98765]) {
      expect(niceScale(max).top).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("código del comprobante", () => {
  it("rellena el número a 8 cifras", () => {
    expect(formatInvoiceCode({ series: "F001", number: 123 })).toBe(
      "F001-00000123",
    );
  });
});
