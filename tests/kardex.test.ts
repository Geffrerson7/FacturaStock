import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prisma se sustituye por funciones simuladas, como en el resto de tests.
const db = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  });

  return {
    product: model(),
    category: model(),
    stockMovement: model(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
});

vi.mock("@/src/lib/prisma", () => ({ prisma: db }));

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/auth", () => ({ auth: { api: { getSession } } }));

import * as exportRoute from "@/app/api/kardex/export/route";
import * as kardexRoute from "@/app/api/kardex/route";
import * as initialCostRoute from "@/app/api/productos/[id]/costo-inicial/route";
import * as productRoute from "@/app/api/productos/[id]/route";
import * as productsRoute from "@/app/api/productos/route";
import { DEV_COMPANY_INFO, getCompanyInfo } from "@/src/lib/company";
import { DEMO_PRODUCTS } from "@/src/lib/demo-data/catalog";
import { planProductKardex } from "@/src/lib/demo-data/kardex";
import { DEMO_HISTORY_DAYS, planDemoSales } from "@/src/lib/demo-data/plan";
import { buildKardexRows } from "@/src/lib/kardex/bulk";
import {
  applyMovement,
  EMPTY_BALANCE,
  InsufficientStockError,
  KardexInputError,
  rebuildMovements,
  replayMovements,
  toDecimal,
} from "@/src/lib/kardex/calc";
import { sunatOperationCode } from "@/src/lib/kardex/catalog";
import { recordMovement } from "@/src/lib/kardex/engine";
import { buildKardexWorkbook, kardexFileName } from "@/src/lib/kardex/excel";
import { resolveKardexRange, summarizeTotals } from "@/src/lib/kardex/query";
import { addDays, startOfLimaDay } from "@/src/lib/lima-time";
import type { KardexReport, StockMovement } from "@/src/lib/types/kardex";
import { createMovementSchema } from "@/src/lib/validations/kardex";

const PRODUCT_ID = "9b2e4d7a-1c3f-4a5b-8d6e-2f1a0b9c8d7e";
const CATEGORY_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

type Handler = (request: Request, ctx: never) => Promise<Response>;

function call(
  handler: Handler,
  method: string,
  path: string,
  { body, id }: { body?: unknown; id?: string } = {},
) {
  const request = new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return handler(request, { params: Promise.resolve({ id }) } as never);
}

function sessionAs(role: "ADMIN" | "DEMO") {
  getSession.mockResolvedValue({
    session: { id: "session-1" },
    user: { id: "user-1", name: "Admin", email: "admin@test.dev", role },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionAs("ADMIN");
  db.$transaction.mockImplementation((argument: unknown) =>
    typeof argument === "function"
      ? (argument as (tx: typeof db) => unknown)(db)
      : Promise.all(argument as Promise<unknown>[]),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const money = (value: { toFixed(digits: number): string }) => value.toFixed(2);

// ---------------------------------------------------------------------------
// Cálculo del costo promedio
// ---------------------------------------------------------------------------

describe("costo promedio ponderado", () => {
  it("promedia las entradas a costos distintos", () => {
    const [first, second] = replayMovements([
      { kind: "entry", quantity: 10, unitCost: "2.00" },
      { kind: "entry", quantity: 30, unitCost: "3.00" },
    ]);

    expect(money(first.balance.value)).toBe("20.00");
    // (20 + 90) / 40 = 2.75
    expect(second.balance.quantity).toBe(40);
    expect(second.balance.averageCost.toString()).toBe("2.75");
    expect(money(second.balance.value)).toBe("110.00");
  });

  it("las salidas salen al promedio y no lo cambian", () => {
    const rows = replayMovements([
      { kind: "entry", quantity: 10, unitCost: "2.00" },
      { kind: "entry", quantity: 30, unitCost: "3.00" },
      { kind: "exit", quantity: 8 },
    ]);
    const exit = rows[2];

    expect(exit.direction).toBe("SALIDA");
    expect(exit.unitCost.toString()).toBe("2.75");
    expect(money(exit.totalCost)).toBe("22.00");
    expect(exit.balance.quantity).toBe(32);
    expect(exit.balance.averageCost.toString()).toBe("2.75");
    expect(money(exit.balance.value)).toBe("88.00");
  });

  it("guarda el promedio con 6 decimales y redondea los importes a 2", () => {
    const [, second] = replayMovements([
      { kind: "entry", quantity: 3, unitCost: "1.00" },
      { kind: "entry", quantity: 1, unitCost: "2.00" },
      // 5 / 6 = 0.833333...
    ]);
    const third = applyMovement(second.balance, {
      kind: "entry",
      quantity: 2,
      unitCost: "0",
    });

    expect(third.balance.averageCost.toString()).toBe("0.833333");
    expect(money(third.balance.value)).toBe("5.00");
  });

  it("al vender la última unidad el saldo queda en 0 sin céntimos residuales", () => {
    // 3 unidades por S/ 10.00: promedio 3.333333.
    const rows = replayMovements([
      { kind: "entry", quantity: 3, unitCost: "3.333333" },
      { kind: "exit", quantity: 1 },
      { kind: "exit", quantity: 1 },
      { kind: "exit", quantity: 1 },
    ]);
    const last = rows.at(-1)!;

    expect(last.balance.quantity).toBe(0);
    expect(last.balance.value.isZero()).toBe(true);
    // La suma de las salidas es exactamente el valor que entró.
    const exits = rows.slice(1).reduce((sum, row) => sum.add(row.totalCost), toDecimal(0));
    expect(exits.equals(rows[0].totalCost)).toBe(true);
    // El promedio se conserva para el siguiente ajuste positivo.
    expect(last.balance.averageCost.toString()).toBe("3.333333");
  });

  it("el ajuste de valorización cambia el valor, no las unidades", () => {
    const [entry] = replayMovements([
      { kind: "entry", quantity: 10, unitCost: "0" },
    ]);
    const revaluation = applyMovement(entry.balance, {
      kind: "revaluation",
      unitCost: "4.50",
    });

    expect(revaluation.direction).toBe("NINGUNA");
    expect(revaluation.quantity).toBe(0);
    expect(revaluation.balance.quantity).toBe(10);
    expect(revaluation.balance.averageCost.toString()).toBe("4.5");
    expect(money(revaluation.balance.value)).toBe("45.00");
    expect(money(revaluation.totalCost)).toBe("45.00");
  });

  it("rechaza saldos negativos y datos imposibles", () => {
    expect(() =>
      applyMovement(EMPTY_BALANCE, { kind: "exit", quantity: 1 }),
    ).toThrowError(InsufficientStockError);
    expect(() =>
      applyMovement(EMPTY_BALANCE, { kind: "entry", quantity: 0, unitCost: 1 }),
    ).toThrowError(KardexInputError);
    expect(() =>
      applyMovement(EMPTY_BALANCE, { kind: "entry", quantity: 1, unitCost: -1 }),
    ).toThrowError(KardexInputError);
    expect(() =>
      applyMovement(EMPTY_BALANCE, { kind: "revaluation", unitCost: 1 }),
    ).toThrowError(KardexInputError);
  });

  it("la anulación vuelve al costo de la salida original, no al promedio actual", () => {
    const rows = rebuildMovements([
      { type: "SALDO_INICIAL", quantity: 10, unitCost: "2.00" },
      { type: "VENTA", quantity: 4, unitCost: "0" },
      // El ingreso sube el promedio: (12 + 6 × 5) / 12 = 3.5
      { type: "INGRESO", quantity: 6, unitCost: "5.00" },
      { type: "ANULACION_VENTA", quantity: 4, unitCost: "0", reversesIndex: 1 },
    ]);

    expect(rows[2].balance.averageCost.toString()).toBe("3.5");
    expect(rows[3].unitCost.toString()).toBe("2");
    expect(money(rows[3].totalCost)).toBe("8.00");
    // (42 + 8) / 16 = 3.125
    expect(rows[3].balance.averageCost.toString()).toBe("3.125");
  });

  it("al corregir el costo del saldo inicial se recalculan las salidas", () => {
    const before = rebuildMovements([
      { type: "SALDO_INICIAL", quantity: 5, unitCost: "0" },
      { type: "VENTA", quantity: 2, unitCost: "0" },
    ]);
    const after = rebuildMovements([
      { type: "SALDO_INICIAL", quantity: 5, unitCost: "1.50" },
      { type: "VENTA", quantity: 2, unitCost: "0" },
    ]);

    expect(money(before[1].totalCost)).toBe("0.00");
    expect(money(after[1].totalCost)).toBe("3.00");
    expect(money(after[1].balance.value)).toBe("4.50");
  });

  it("usa los códigos de la tabla 12 de SUNAT", () => {
    expect(sunatOperationCode("SALDO_INICIAL", "MANUAL")).toBe("16");
    expect(sunatOperationCode("VENTA", "SALE")).toBe("01");
    expect(sunatOperationCode("ANULACION_VENTA", "SALE_CANCELLATION")).toBe("05");
    expect(sunatOperationCode("MERMA", "MANUAL")).toBe("13");
    expect(sunatOperationCode("INGRESO", "MANUAL")).toBe("99");
    // Preparado para el módulo de compras.
    expect(sunatOperationCode("INGRESO", "PURCHASE")).toBe("02");
  });
});

// ---------------------------------------------------------------------------
// Motor: escritura con bloqueo de fila
// ---------------------------------------------------------------------------

type MemoryProduct = {
  stock: number;
  last_cost: string;
  average_cost: string;
  inventory_value: string;
};

/**
 * Base en memoria con el comportamiento que importa del SELECT ... FOR
 * UPDATE: una transacción que lee la fila espera a que termine la anterior.
 */
function memoryDb(initial: MemoryProduct) {
  const product = { ...initial };
  const movements: { sequence: number; type: string; quantity: number }[] = [];
  let lockTail: Promise<void> = Promise.resolve();
  const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

  async function transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    let holdsLock = false;

    const tx = {
      $queryRaw: async () => {
        const previous = lockTail;
        lockTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        holdsLock = true;
        await previous;
        return [{ name: "Agua", ...product }];
      },
      stockMovement: {
        aggregate: async () => {
          // Una pausa entre leer y escribir: sin bloqueo, otra transacción
          // leería el mismo correlativo.
          await tick();
          return {
            _max: { sequence: movements.at(-1)?.sequence ?? null },
          };
        },
        create: async ({ data }: { data: { sequence: number; type: string; quantity: number } }) => {
          if (movements.some((m) => m.sequence === data.sequence)) {
            throw new Error("Unique constraint failed on (product_id, sequence)");
          }
          movements.push(data);
          return { id: `m-${data.sequence}`, ...data };
        },
      },
      product: {
        update: async ({ data }: { data: Record<string, { toString(): string } | number> }) => {
          product.stock = Number(data.stock);
          product.average_cost = String(data.averageCost);
          product.inventory_value = String(data.inventoryValue);
          if (data.lastCost !== undefined) product.last_cost = String(data.lastCost);
          return {};
        },
      },
    };

    try {
      return await fn(tx);
    } finally {
      if (holdsLock) release();
    }
  }

  return { product, movements, transaction };
}

describe("motor del kárdex", () => {
  it("registra el movimiento con el siguiente correlativo y actualiza el producto", async () => {
    const memory = memoryDb({
      stock: 10,
      last_cost: "2",
      average_cost: "2",
      inventory_value: "20",
    });

    await memory.transaction((tx) =>
      recordMovement(tx as never, {
        productId: PRODUCT_ID,
        type: "INGRESO",
        quantity: 10,
        unitCost: "4",
        referenceType: "MANUAL",
        reason: "Compra al proveedor",
      }),
    );

    expect(memory.movements).toHaveLength(1);
    expect(memory.movements[0]).toMatchObject({
      sequence: 1,
      type: "INGRESO",
      sunatOperationCode: "99",
      reason: "Compra al proveedor",
    });
    expect(memory.product).toEqual({
      stock: 20,
      last_cost: "4",
      average_cost: "3",
      inventory_value: "60",
    });
  });

  it("un ingreso sin costo toma el último costo del producto", async () => {
    const memory = memoryDb({
      stock: 0,
      last_cost: "1.75",
      average_cost: "1.75",
      inventory_value: "0",
    });

    await memory.transaction((tx) =>
      recordMovement(tx as never, {
        productId: PRODUCT_ID,
        type: "INGRESO",
        quantity: 4,
        unitCost: null,
        referenceType: "MANUAL",
      }),
    );

    expect(memory.product.inventory_value).toBe("7");
  });

  it("los ajustes y las mermas usan el promedio y no cambian el último costo", async () => {
    const memory = memoryDb({
      stock: 10,
      last_cost: "9",
      average_cost: "2.5",
      inventory_value: "25",
    });

    await memory.transaction((tx) =>
      recordMovement(tx as never, {
        productId: PRODUCT_ID,
        type: "AJUSTE_POSITIVO",
        quantity: 2,
        // Se ignora: un ajuste positivo entra al promedio.
        unitCost: "100",
        referenceType: "MANUAL",
      }),
    );
    await memory.transaction((tx) =>
      recordMovement(tx as never, {
        productId: PRODUCT_ID,
        type: "MERMA",
        quantity: 3,
        referenceType: "MANUAL",
      }),
    );

    expect(memory.product).toEqual({
      stock: 9,
      last_cost: "9",
      average_cost: "2.5",
      inventory_value: "22.5",
    });
  });

  it("responde 409 si no alcanza el stock", async () => {
    const memory = memoryDb({
      stock: 2,
      last_cost: "1",
      average_cost: "1",
      inventory_value: "2",
    });

    await expect(
      memory.transaction((tx) =>
        recordMovement(tx as never, {
          productId: PRODUCT_ID,
          type: "VENTA",
          quantity: 5,
          referenceType: "SALE",
        }),
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
      message: 'No hay stock suficiente de "Agua". Disponible: 2, solicitado: 5.',
    });
    expect(memory.movements).toHaveLength(0);
  });

  it("dos ventas y un ajuste simultáneos dejan el saldo correcto y correlativos sin huecos", async () => {
    const memory = memoryDb({
      stock: 10,
      last_cost: "2",
      average_cost: "2",
      inventory_value: "20",
    });

    const sale = (quantity: number) =>
      memory.transaction((tx) =>
        recordMovement(tx as never, {
          productId: PRODUCT_ID,
          type: "VENTA",
          quantity,
          referenceType: "SALE",
        }),
      );

    const results = await Promise.allSettled([
      sale(4),
      sale(5),
      memory.transaction((tx) =>
        recordMovement(tx as never, {
          productId: PRODUCT_ID,
          type: "AJUSTE_NEGATIVO",
          quantity: 1,
          referenceType: "MANUAL",
        }),
      ),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(memory.movements.map((m) => m.sequence)).toEqual([1, 2, 3]);
    expect(memory.product.stock).toBe(0);
    expect(memory.product.inventory_value).toBe("0");
  });

  it("de dos ventas simultáneas que no caben, la segunda recibe 409", async () => {
    const memory = memoryDb({
      stock: 6,
      last_cost: "2",
      average_cost: "2",
      inventory_value: "12",
    });

    const sale = () =>
      memory.transaction((tx) =>
        recordMovement(tx as never, {
          productId: PRODUCT_ID,
          type: "VENTA",
          quantity: 4,
          referenceType: "SALE",
        }),
      );

    const results = await Promise.allSettled([sale(), sale()]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(memory.product.stock).toBe(2);
    expect(memory.movements).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Invariante sobre los datos de la demo
// ---------------------------------------------------------------------------

describe("kárdex de la demo", () => {
  const now = new Date("2026-11-15T17:00:00Z");
  const firstDay = addDays(startOfLimaDay(now), -(DEMO_HISTORY_DAYS - 1));
  const sales = planDemoSales(firstDay, now).map((sale, index) => ({
    ...sale,
    id: `sale-${index}`,
  }));

  const kardexes = DEMO_PRODUCTS.map((product, index) => ({
    product,
    built: buildKardexRows(
      `product-${index}`,
      planProductKardex(product, index, sales, firstDay, now),
    ),
  }));

  it("cada producto termina con el stock del catálogo y nunca queda en negativo", () => {
    for (const { product, built } of kardexes) {
      expect(built.product.stock, product.sku).toBe(product.stock);

      for (const row of built.rows) {
        expect(row.balanceQuantity, product.sku).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("registra una salida por cada línea de venta y reposiciones con costo", () => {
    const lines = sales.reduce((sum, sale) => sum + sale.items.length, 0);
    const exits = kardexes.flatMap(({ built }) =>
      built.rows.filter((row) => row.type === "VENTA"),
    );
    const restocks = kardexes.flatMap(({ built }) =>
      built.rows.filter((row) => row.type === "INGRESO"),
    );

    expect(exits).toHaveLength(lines);
    expect(restocks.length).toBeGreaterThan(0);
    expect(
      restocks.every((row) => toDecimal(row.unitCost as string).greaterThan(0)),
    ).toBe(true);
  });

  it("el saldo del producto coincide con el último movimiento y recalcular no cambia nada", () => {
    for (const { product, built } of kardexes) {
      const last = built.rows.at(-1);
      if (!last) continue;

      expect(built.product.stock).toBe(last.balanceQuantity);
      expect(
        toDecimal(built.product.inventoryValue).equals(
          toDecimal(last.balanceValue as string),
        ),
        product.sku,
      ).toBe(true);

      const rebuilt = rebuildMovements(
        built.rows.map((row) => ({
          type: row.type,
          quantity: row.quantity,
          unitCost: row.unitCost as string,
        })),
      );

      rebuilt.forEach((result, index) => {
        const row = built.rows[index];
        expect(result.balance.quantity).toBe(row.balanceQuantity);
        expect(result.balance.value.equals(toDecimal(row.balanceValue as string))).toBe(true);
      });
    }
  });

  it("saldo anterior + entradas − salidas = saldo final", () => {
    for (const { built } of kardexes) {
      const groups = (["ENTRADA", "SALIDA", "NINGUNA"] as const).map((direction) => {
        const rows = built.rows.filter((row) => row.direction === direction);
        return {
          direction,
          _sum: {
            quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
            totalCost: rows.reduce(
              (sum, row) => sum.add(toDecimal(row.totalCost as string)),
              toDecimal(0),
            ),
          },
        };
      });
      const totals = summarizeTotals(groups);

      expect(totals.entries.quantity - totals.exits.quantity).toBe(
        built.product.stock,
      );
      expect(
        toDecimal(totals.entries.value)
          .sub(toDecimal(totals.exits.value))
          .equals(built.product.inventoryValue),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Rango de fechas y validaciones
// ---------------------------------------------------------------------------

describe("consulta del kárdex", () => {
  it("por defecto muestra el mes en curso, en la hora de Lima", () => {
    // 1 de diciembre a las 02:00 UTC: en Lima todavía es 30 de noviembre.
    const range = resolveKardexRange(
      undefined,
      undefined,
      new Date("2026-12-01T02:00:00Z"),
    );

    expect(range.from).toBe("2026-11-01");
    expect(range.to).toBe("2026-11-30");
    expect(range.start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("exige motivo, cantidad y, en una revalorización, el nuevo costo", () => {
    const base = { productId: PRODUCT_ID, reason: "Conteo físico" };

    expect(
      createMovementSchema.safeParse({ ...base, type: "MERMA", reason: "" }).success,
    ).toBe(false);
    expect(createMovementSchema.safeParse({ ...base, type: "MERMA" }).success).toBe(
      false,
    );
    expect(
      createMovementSchema.safeParse({ ...base, type: "AJUSTE_VALORIZACION" })
        .success,
    ).toBe(false);
    expect(
      createMovementSchema.safeParse({
        ...base,
        type: "INGRESO",
        quantity: 5,
        unitCost: "",
      }).data,
    ).toMatchObject({ quantity: 5, unitCost: null });
    // Una venta o un saldo inicial no se registran a mano.
    expect(
      createMovementSchema.safeParse({ ...base, type: "VENTA", quantity: 1 })
        .success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Datos de la empresa
// ---------------------------------------------------------------------------

describe("datos de la empresa", () => {
  it("en desarrollo usa los valores por defecto", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COMPANY_RUC", "");

    expect(getCompanyInfo()).toEqual(DEV_COMPANY_INFO);
  });

  it("lee las variables de entorno", () => {
    vi.stubEnv("COMPANY_RUC", "20131312955");
    vi.stubEnv("COMPANY_BUSINESS_NAME", "Bodega Central S.A.C.");
    vi.stubEnv("COMPANY_ESTABLISHMENT", "0001 - Av. Lima 123");

    expect(getCompanyInfo()).toEqual({
      ruc: "20131312955",
      businessName: "Bodega Central S.A.C.",
      establishment: "0001 - Av. Lima 123",
    });
  });

  it("en producción falla si falta un valor o el RUC no es válido", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COMPANY_RUC", "");
    vi.stubEnv("COMPANY_BUSINESS_NAME", "Bodega Central S.A.C.");
    vi.stubEnv("COMPANY_ESTABLISHMENT", "0001");

    expect(() => getCompanyInfo()).toThrowError(/COMPANY_RUC/);

    vi.stubEnv("COMPANY_RUC", "123");
    expect(() => getCompanyInfo()).toThrowError(/11 dígitos/);
  });
});

// ---------------------------------------------------------------------------
// Exportación a Excel
// ---------------------------------------------------------------------------

function movement(partial: Partial<StockMovement>): StockMovement {
  return {
    id: "m",
    sequence: 1,
    type: "INGRESO",
    direction: "ENTRADA",
    sunatOperationCode: "99",
    quantity: 0,
    unitCost: "0",
    totalCost: "0",
    balanceQuantity: 0,
    balanceAverageCost: "0",
    balanceValue: "0",
    documentType: "00",
    documentSeries: null,
    documentNumber: null,
    referenceType: "MANUAL",
    referenceId: null,
    reason: null,
    occurredAt: "2026-11-10T15:00:00.000Z",
    user: null,
    ...partial,
  };
}

const REPORT: KardexReport = {
  product: {
    id: PRODUCT_ID,
    name: "Agua mineral 500 ml",
    sku: "BEB-001",
    stock: 15,
    lastCost: "2",
    averageCost: "1.75",
    inventoryValue: "26.25",
    isActive: true,
  },
  range: { from: "2026-11-01", to: "2026-11-17" },
  opening: { quantity: 10, averageCost: "1.5", value: "15" },
  closing: { quantity: 15, averageCost: "1.75", value: "26.25" },
  totals: {
    entries: { quantity: 10, value: "20" },
    exits: { quantity: 5, value: "8.75" },
  },
  canEditInitialCost: false,
  movements: [
    movement({
      sequence: 2,
      type: "INGRESO",
      direction: "ENTRADA",
      quantity: 10,
      unitCost: "2",
      totalCost: "20",
      balanceQuantity: 20,
      balanceAverageCost: "1.75",
      balanceValue: "35",
      // 23:30 en Lima del 10/11, ya 11/11 en UTC.
      occurredAt: "2026-11-11T04:30:00.000Z",
    }),
    movement({
      sequence: 3,
      type: "VENTA",
      direction: "SALIDA",
      sunatOperationCode: "01",
      quantity: 5,
      unitCost: "1.75",
      totalCost: "8.75",
      balanceQuantity: 15,
      balanceAverageCost: "1.75",
      balanceValue: "26.25",
      documentType: "03",
      documentSeries: "B001",
      documentNumber: 42,
      referenceType: "SALE",
      occurredAt: "2026-11-12T15:00:00.000Z",
    }),
  ],
};

async function reload(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as ArrayBuffer);
  return loaded.worksheets[0];
}

function findRow(sheet: ExcelJS.Worksheet, text: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value === text) found ??= row;
    });
  });
  if (!found) throw new Error(`No se encontró "${text}"`);
  return found;
}

describe("exportación del kárdex", () => {
  it("el valorizado sigue el Formato 13.1 con cabecera, grupos y totales", async () => {
    const sheet = await reload(
      buildKardexWorkbook(REPORT, DEV_COMPANY_INFO, "valorizado"),
    );

    expect(String(sheet.getCell("A1").value)).toContain("FORMATO 13.1");
    expect(sheet.getCell("A1").isMerged).toBe(true);
    expect(findRow(sheet, "RUC:").getCell(6).value).toBe(DEV_COMPANY_INFO.ruc);
    expect(findRow(sheet, "CÓDIGO DE LA EXISTENCIA:").getCell(6).value).toBe("BEB-001");
    expect(findRow(sheet, "MÉTODO DE VALUACIÓN:").getCell(6).value).toBe(
      "Promedio ponderado",
    );

    const header = findRow(sheet, "FECHA");
    expect(header.getCell(6).value).toBe("ENTRADAS");
    expect(header.getCell(9).value).toBe("SALIDAS");
    expect(header.getCell(12).value).toBe("SALDO FINAL");
    const subheader = sheet.getRow(header.number + 1);
    expect(
      [2, 3, 4, 6, 7, 8, 13].map((column) => subheader.getCell(column).value),
    ).toEqual([
      "TIPO (TABLA 10)",
      "SERIE",
      "NÚMERO",
      "CANTIDAD",
      "COSTO UNITARIO",
      "COSTO TOTAL",
      "COSTO PROMEDIO",
    ]);

    const opening = findRow(sheet, "SALDO ANTERIOR");
    expect(opening.getCell(12).value).toBe(10);
    expect(opening.getCell(14).value).toBe(15);

    // Entrada: la fecha es la de Lima (10/11), no la de UTC.
    const entry = sheet.getRow(opening.number + 1);
    expect((entry.getCell(1).value as Date).toISOString().slice(0, 10)).toBe(
      "2026-11-10",
    );
    expect(entry.getCell(1).numFmt).toBe("dd/mm/yyyy");
    expect([6, 7, 8].map((c) => entry.getCell(c).value)).toEqual([10, 2, 20]);
    expect(entry.getCell(9).value).toBeNull();

    const exit = sheet.getRow(opening.number + 2);
    expect([2, 3, 4].map((c) => exit.getCell(c).value)).toEqual([
      "03",
      "B001",
      "00000042",
    ]);
    expect(String(exit.getCell(5).value)).toBe("01 - Venta");
    expect([9, 10, 11].map((c) => exit.getCell(c).value)).toEqual([5, 1.75, 8.75]);
    expect(exit.getCell(11).numFmt).toBe("#,##0.00");

    const totals = findRow(sheet, "TOTALES");
    expect([6, 8, 9, 11, 12, 13, 14].map((c) => totals.getCell(c).value)).toEqual([
      10, 20, 5, 8.75, 15, 1.75, 26.25,
    ]);
    expect(totals.getCell(14).border.top?.style).toBe("thin");
  });

  it("el físico solo tiene unidades (Formato 12.1)", async () => {
    const sheet = await reload(
      buildKardexWorkbook(REPORT, DEV_COMPANY_INFO, "fisico"),
    );

    expect(String(sheet.getCell("A1").value)).toContain("FORMATO 12.1");
    expect(() => findRow(sheet, "MÉTODO DE VALUACIÓN:")).toThrow();
    expect(sheet.columnCount).toBe(8);

    const totals = findRow(sheet, "TOTALES");
    expect([6, 7, 8].map((c) => totals.getCell(c).value)).toEqual([10, 5, 15]);
  });

  it("nombra el archivo con el modo, el SKU y el rango", () => {
    expect(kardexFileName(REPORT, "valorizado")).toBe(
      "kardex-valorizado-BEB-001-2026-11-01-2026-11-17.xlsx",
    );
  });

  it("el endpoint devuelve el .xlsx como adjunto", async () => {
    db.product.findUnique.mockResolvedValue({
      id: PRODUCT_ID,
      name: "Agua mineral 500 ml",
      sku: "BEB-001",
      stock: 0,
      lastCost: toDecimal(0),
      averageCost: toDecimal(0),
      inventoryValue: toDecimal(0),
      isActive: true,
    });
    db.stockMovement.findFirst.mockResolvedValue(null);
    db.stockMovement.findMany.mockResolvedValue([]);
    db.stockMovement.count.mockResolvedValue(0);
    db.stockMovement.groupBy.mockResolvedValue([]);

    const response = await call(
      exportRoute.GET,
      "GET",
      `/api/kardex/export?productId=${PRODUCT_ID}&from=2026-11-01&to=2026-11-17&mode=fisico`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="kardex-fisico-BEB-001-2026-11-01-2026-11-17.xlsx"',
    );

    // Es un .xlsx válido (un ZIP que ExcelJS sabe abrir).
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await response.arrayBuffer());
    expect(loaded.worksheets[0].name).toBe("Kárdex físico");
  });

  it("el usuario de demostración puede exportar pero no registrar movimientos", async () => {
    sessionAs("DEMO");

    const response = await call(kardexRoute.POST, "POST", "/api/kardex", {
      body: {
        productId: PRODUCT_ID,
        type: "INGRESO",
        quantity: 1,
        reason: "Prueba",
      },
    });

    expect(response.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Productos y kárdex
// ---------------------------------------------------------------------------

describe("productos y kárdex", () => {
  const productBody = {
    name: "Agua mineral 500 ml",
    sku: "BEB-001",
    price: 2.5,
    stock: 12,
    initialCost: 1.2,
    categoryId: CATEGORY_ID,
  };

  it("el stock inicial entra como saldo inicial con su costo", async () => {
    db.category.findUnique.mockResolvedValue({ id: CATEGORY_ID });
    db.product.create.mockResolvedValue({ id: PRODUCT_ID });
    db.product.findUniqueOrThrow.mockResolvedValue({ id: PRODUCT_ID });
    db.$queryRaw.mockResolvedValue([
      {
        name: "Agua",
        stock: 0,
        last_cost: "0",
        average_cost: "0",
        inventory_value: "0",
      },
    ]);
    db.stockMovement.aggregate.mockResolvedValue({ _max: { sequence: null } });
    db.stockMovement.create.mockResolvedValue({ id: "m-1" });

    const response = await call(productsRoute.POST, "POST", "/api/productos", {
      body: productBody,
    });

    expect(response.status).toBe(201);
    // El producto nace sin stock: lo pone el movimiento.
    const created = db.product.create.mock.calls[0][0].data;
    expect(created).not.toHaveProperty("stock");
    expect(created).not.toHaveProperty("initialCost");

    const { data } = db.stockMovement.create.mock.calls[0][0];
    expect(data).toMatchObject({
      type: "SALDO_INICIAL",
      sunatOperationCode: "16",
      quantity: 12,
      balanceQuantity: 12,
      userId: "user-1",
    });
    expect(money(data.totalCost)).toBe("14.40");
    expect(db.product.update.mock.calls[0][0].data).toMatchObject({ stock: 12 });
  });

  it("al editar un producto se ignora el stock", async () => {
    db.category.findUnique.mockResolvedValue({ id: CATEGORY_ID });
    db.product.findUnique.mockResolvedValue({ imagePublicId: null });
    db.product.update.mockResolvedValue({ id: PRODUCT_ID, imagePublicId: null });

    const response = await call(productRoute.PUT, "PUT", `/api/productos/${PRODUCT_ID}`, {
      id: PRODUCT_ID,
      body: { ...productBody, stock: 999 },
    });

    expect(response.status).toBe(200);
    const data = db.product.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("stock");
    expect(data).not.toHaveProperty("initialCost");
  });

  it("un producto con movimientos no se elimina", async () => {
    db.stockMovement.count.mockResolvedValue(3);

    const response = await call(
      productRoute.DELETE,
      "DELETE",
      `/api/productos/${PRODUCT_ID}`,
      { id: PRODUCT_ID },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("PRODUCT_HAS_MOVEMENTS");
    expect(body.error.message).toContain("Desactívalo");
    expect(db.product.delete).not.toHaveBeenCalled();
  });

  it("el costo del saldo inicial solo se corrige si no hay movimientos posteriores", async () => {
    db.stockMovement.findMany.mockResolvedValueOnce([
      { id: "m-1", type: "SALDO_INICIAL" },
      { id: "m-2", type: "VENTA" },
    ]);

    const response = await call(
      initialCostRoute.PUT,
      "PUT",
      `/api/productos/${PRODUCT_ID}/costo-inicial`,
      { id: PRODUCT_ID, body: { unitCost: 1.5 } },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("INITIAL_BALANCE_LOCKED");
    expect(body.error.message).toContain("ajuste de valorización");
    expect(db.stockMovement.update).not.toHaveBeenCalled();
  });

  it("corrige el costo del saldo inicial y recalcula el valor", async () => {
    const stored = {
      id: "m-1",
      sequence: 1,
      type: "SALDO_INICIAL",
      quantity: 10,
      unitCost: toDecimal(0),
      totalCost: toDecimal(0),
      balanceQuantity: 10,
      balanceAverageCost: toDecimal(0),
      balanceValue: toDecimal(0),
      reversesMovementId: null,
    };
    db.stockMovement.findMany
      .mockResolvedValueOnce([{ id: "m-1", type: "SALDO_INICIAL" }])
      .mockImplementationOnce(async () => [stored]);
    db.stockMovement.update.mockImplementation(async ({ data }) => {
      Object.assign(stored, data);
      return stored;
    });
    db.$queryRaw.mockResolvedValue([{ name: "Agua" }]);
    db.product.findUniqueOrThrow.mockResolvedValue({ id: PRODUCT_ID });

    const response = await call(
      initialCostRoute.PUT,
      "PUT",
      `/api/productos/${PRODUCT_ID}/costo-inicial`,
      { id: PRODUCT_ID, body: { unitCost: 1.5 } },
    );

    expect(response.status).toBe(200);
    expect(money(stored.balanceValue)).toBe("15.00");
    const product = db.product.update.mock.calls.at(-1)![0].data;
    expect(product.stock).toBe(10);
    expect(money(product.inventoryValue)).toBe("15.00");
    expect(product.lastCost.toString()).toBe("1.5");
  });
});
