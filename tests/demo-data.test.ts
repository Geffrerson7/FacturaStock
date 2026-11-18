import { existsSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_CUSTOMERS,
  DEMO_PRODUCTS,
  demoProductImagePath,
  rucWithCheckDigit,
} from "@/src/lib/demo-data/catalog";
import {
  DEMO_HISTORY_DAYS,
  planDemoDay,
  planDemoSales,
} from "@/src/lib/demo-data/plan";
import { DEMO_SALE_WHERE, syncDemoData } from "@/src/lib/demo-data/sync";
import { limaDateKey } from "@/src/lib/lima-time";
import { createProductSchema } from "@/src/lib/validations/product";
import { createCustomerSchema } from "@/src/lib/validations/customer";

describe("catálogo de la demo", () => {
  it("tiene unas decenas de productos con SKU único y su ilustración", () => {
    const skus = DEMO_PRODUCTS.map((product) => product.sku);

    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(skus).size).toBe(skus.length);

    for (const product of DEMO_PRODUCTS) {
      const path = demoProductImagePath(product.sku);
      expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true);
    }
  });

  it("los productos pasan la validación del formulario, imagen incluida", () => {
    for (const product of DEMO_PRODUCTS) {
      const result = createProductSchema.safeParse({
        ...product,
        categoryId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        imageUrl: demoProductImagePath(product.sku),
      });

      expect(result.success, product.sku).toBe(true);
    }
  });

  it("la imagen local solo admite la carpeta de la demo", () => {
    const base = {
      name: "Agua",
      sku: "X-1",
      price: 1,
      stock: 1,
      categoryId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    };

    expect(
      createProductSchema.safeParse({ ...base, imageUrl: "/demo/../secret.svg" })
        .success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({ ...base, imageUrl: "/otra/imagen.svg" })
        .success,
    ).toBe(false);
  });

  it("incluye productos agotados y con stock bajo para el dashboard", () => {
    expect(DEMO_PRODUCTS.some((p) => p.stock === 0)).toBe(true);
    expect(
      DEMO_PRODUCTS.some((p) => p.stock > 0 && p.stock <= p.lowStockThreshold),
    ).toBe(true);
  });

  it("los clientes son válidos y hay personas y empresas", () => {
    for (const customer of DEMO_CUSTOMERS) {
      expect(createCustomerSchema.safeParse(customer).success).toBe(true);
    }

    expect(DEMO_CUSTOMERS.some((c) => c.documentType === "DNI")).toBe(true);
    expect(DEMO_CUSTOMERS.some((c) => c.documentType === "RUC")).toBe(true);
  });

  it("calcula el dígito verificador del RUC como SUNAT", () => {
    // RUC de la SUNAT: 20131312955.
    expect(rucWithCheckDigit("2013131295")).toBe("20131312955");
  });
});

describe("ventas de ejemplo", () => {
  it("el mismo día genera siempre las mismas ventas", () => {
    expect(planDemoDay("2026-11-14")).toEqual(planDemoDay("2026-11-14"));
    expect(planDemoDay("2026-11-14")).not.toEqual(planDemoDay("2026-11-13"));
  });

  it("las ventas caen en horario de tienda, en la hora de Lima", () => {
    for (const sale of planDemoDay("2026-11-14")) {
      expect(limaDateKey(sale.createdAt)).toBe("2026-11-14");
      const hour = (sale.createdAt.getUTCHours() + 24 - 5) % 24;
      expect(hour).toBeGreaterThanOrEqual(9);
      expect(hour).toBeLessThan(21);
      expect(sale.items.length).toBeGreaterThan(0);
    }
  });

  it("no genera ventas futuras y la historia empieza el primer día", () => {
    const now = new Date("2026-11-15T17:00:00Z"); // 12:00 en Lima
    const first = new Date("2026-10-05T05:00:00Z");
    const sales = planDemoSales(first, now);

    expect(sales.every((sale) => sale.createdAt <= now)).toBe(true);
    expect(limaDateKey(sales[0].createdAt)).toBe("2026-10-05");
  });

  it("agregar por horas da lo mismo que generar todo de una vez", () => {
    const first = new Date("2026-11-14T05:00:00Z");
    const noon = new Date("2026-11-15T17:00:00Z");
    const evening = new Date("2026-11-16T01:00:00Z"); // 15/11 20:00 en Lima

    const once = planDemoSales(first, evening);
    const morning = planDemoSales(first, noon);
    const rest = planDemoSales(first, evening, morning.at(-1)!.createdAt);

    expect([...morning, ...rest]).toEqual(once);
  });
});

describe("sincronización de la demo", () => {
  const now = new Date("2026-11-15T17:00:00Z");

  const db = {
    sale: { aggregate: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    saleItem: { createMany: vi.fn() },
    product: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    customer: { upsert: vi.fn(), findMany: vi.fn() },
    category: { upsert: vi.fn() },
    stockMovement: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    let id = 0;
    const withId = () => Promise.resolve({ id: `id-${(id += 1)}` });
    db.product.upsert.mockImplementation(withId);
    db.customer.upsert.mockImplementation(withId);
    db.category.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: `cat-${create.name}`, name: create.name }),
    );
    db.sale.createMany.mockReturnValue("sales");
    db.saleItem.createMany.mockReturnValue("items");
    db.stockMovement.deleteMany.mockReturnValue("delete-movements");
    db.stockMovement.createMany.mockReturnValue("create-movements");
    db.product.update.mockReturnValue("update-product");
    // Una lista de consultas se resuelve sin más; una función recibe el
    // cliente, como en Prisma.
    db.$transaction.mockImplementation((argument: unknown) =>
      typeof argument === "function"
        ? (argument as (tx: typeof db) => unknown)(db)
        : Promise.resolve([]),
    );
  });

  it("sin ventas de ejemplo hace el reinicio completo", async () => {
    db.sale.aggregate.mockResolvedValue({
      _min: { createdAt: null },
      _max: { createdAt: null },
    });

    const result = await syncDemoData(db as never, now);

    expect(result.action).toBe("reset");
    expect(result.salesCreated).toBeGreaterThan(DEMO_HISTORY_DAYS * 3);
    // Solo borra las ventas sin comprobante: nunca una venta real.
    expect(db.sale.deleteMany).toHaveBeenCalledWith({ where: DEMO_SALE_WHERE });
    expect(db.product.upsert).toHaveBeenCalledTimes(DEMO_PRODUCTS.length);

    const sales = db.sale.createMany.mock.calls[0][0].data;
    const dates = sales.map((sale: { createdAt: Date }) => sale.createdAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    for (const sale of sales) {
      expect(Number(sale.taxableAmount) + Number(sale.igvAmount)).toBeCloseTo(
        Number(sale.total),
        2,
      );
    }
  });

  it("si la historia no empieza en la fecha que toca, reinicia", async () => {
    db.sale.aggregate.mockResolvedValue({
      _min: { createdAt: new Date("2026-10-01T15:00:00Z") },
      _max: { createdAt: new Date("2026-11-14T20:00:00Z") },
    });

    expect((await syncDemoData(db as never, now)).action).toBe("reset");
  });

  it("el mismo día solo agrega las ventas nuevas, sin borrar nada", async () => {
    const first = new Date("2026-10-05T05:00:00Z");
    const tenAm = new Date("2026-11-15T15:00:00Z");
    const done = planDemoSales(first, tenAm);

    db.sale.aggregate.mockResolvedValue({
      _min: { createdAt: done[0].createdAt },
      _max: { createdAt: done.at(-1)!.createdAt },
    });
    db.product.findMany.mockResolvedValue(
      DEMO_PRODUCTS.map((p) => ({ id: `p-${p.sku}`, sku: p.sku })),
    );
    db.customer.findMany.mockResolvedValue(
      DEMO_CUSTOMERS.map((c) => ({
        id: `c-${c.documentType === "DNI" ? c.dni : c.ruc}`,
        dni: c.documentType === "DNI" ? c.dni : null,
        ruc: c.documentType === "RUC" ? c.ruc : null,
      })),
    );

    db.product.findUniqueOrThrow.mockResolvedValue({ stock: 100 });
    db.$queryRaw.mockResolvedValue([
      {
        name: "Producto",
        stock: 100,
        last_cost: "1",
        average_cost: "1",
        inventory_value: "100",
      },
    ]);
    db.stockMovement.aggregate.mockResolvedValue({ _max: { sequence: 10 } });
    db.stockMovement.create.mockResolvedValue({ id: "movement" });
    db.product.update.mockResolvedValue({});

    const result = await syncDemoData(db as never, now);
    const expected = planDemoSales(first, now).length - done.length;

    expect(result).toEqual({ action: "append", salesCreated: expected });
    expect(db.sale.deleteMany).not.toHaveBeenCalled();
    expect(db.product.upsert).not.toHaveBeenCalled();
    expect(db.stockMovement.deleteMany).not.toHaveBeenCalled();

    // Una salida del kárdex por cada línea de las ventas nuevas.
    const lines = planDemoSales(first, now)
      .slice(done.length)
      .reduce((sum, sale) => sum + sale.items.length, 0);
    const exits = db.stockMovement.create.mock.calls.filter(
      ([args]) => args.data.type === "VENTA",
    );
    expect(exits).toHaveLength(lines);
  });
});
