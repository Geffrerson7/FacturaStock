import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";
import { WALK_IN_DNI } from "@/src/lib/customer";
import {
  BULK_TRANSACTION_TIMEOUT_MS,
  replaceKardexBulk,
} from "@/src/lib/kardex/bulk";
import { recordMovement } from "@/src/lib/kardex/engine";
import { addDays, limaDateKey, startOfLimaDay } from "@/src/lib/lima-time";
import { computeSaleTax } from "@/src/lib/tax";

import {
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_PRODUCTS,
  demoProductImagePath,
  type DemoCustomer,
} from "./catalog";
import {
  demoProductCost,
  planProductKardex,
  type DemoKardexSale,
} from "./kardex";
import { DEMO_HISTORY_DAYS, planDemoSales, type PlannedSale } from "./plan";

/**
 * Las ventas de ejemplo son las únicas sin comprobante: toda venta registrada
 * desde la aplicación reserva el suyo en la misma transacción. Así el
 * reinicio nunca toca una venta real ni un comprobante emitido en Nubefact.
 */
export const DEMO_SALE_WHERE = {
  invoice: { is: null },
} satisfies Prisma.SaleWhereInput;

export type DemoSyncResult = {
  action: "reset" | "append";
  salesCreated: number;
};

type CatalogIds = {
  productIds: string[];
  customerIds: string[];
};

function firstHistoryDay(now: Date): Date {
  return addDays(startOfLimaDay(now), -(DEMO_HISTORY_DAYS - 1));
}

function customerData(customer: DemoCustomer) {
  return customer.documentType === "DNI"
    ? {
        documentType: "DNI" as const,
        dni: customer.dni,
        ruc: null,
        firstName: customer.firstName,
        lastName: customer.lastName,
        businessName: null,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
      }
    : {
        documentType: "RUC" as const,
        dni: null,
        ruc: customer.ruc,
        firstName: null,
        lastName: null,
        businessName: customer.businessName,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
      };
}

/**
 * Deja categorías, productos y clientes como en el catálogo: precio, umbral
 * e imagen vuelven a sus valores. El stock no se escribe aquí: lo deja el
 * kárdex de la demo (`rebuildDemoKardex`). Los registros que no son del
 * catálogo no se tocan.
 */
async function restoreCatalog(db: PrismaClient): Promise<CatalogIds> {
  await db.customer.upsert({
    where: { dni: WALK_IN_DNI },
    update: {},
    create: {
      dni: WALK_IN_DNI,
      firstName: "Walk-in",
      lastName: "Customer",
      address: "N/A",
    },
  });

  const categories = await Promise.all(
    DEMO_CATEGORIES.map((category) =>
      db.category.upsert({
        where: { name: category.name },
        update: { description: category.description },
        create: category,
      }),
    ),
  );
  const categoryIds = new Map(categories.map((c) => [c.name, c.id]));

  const products = await Promise.all(
    DEMO_PRODUCTS.map((product) => {
      const data = {
        name: product.name,
        description: product.description,
        price: product.price,
        lowStockThreshold: product.lowStockThreshold,
        isActive: true,
        imageUrl: demoProductImagePath(product.sku),
        imagePublicId: null,
        categoryId: categoryIds.get(product.category)!,
      };

      return db.product.upsert({
        where: { sku: product.sku },
        update: data,
        create: { sku: product.sku, ...data },
        select: { id: true },
      });
    }),
  );

  const customers = await Promise.all(
    DEMO_CUSTOMERS.map((customer) => {
      const data = customerData(customer);

      return db.customer.upsert({
        where:
          customer.documentType === "DNI"
            ? { dni: customer.dni }
            : { ruc: customer.ruc },
        update: data,
        create: data,
        select: { id: true },
      });
    }),
  );

  return {
    productIds: products.map((product) => product.id),
    customerIds: customers.map((customer) => customer.id),
  };
}

async function readCatalogIds(db: PrismaClient): Promise<CatalogIds> {
  const [products, customers] = await Promise.all([
    db.product.findMany({
      where: { sku: { in: DEMO_PRODUCTS.map((product) => product.sku) } },
      select: { id: true, sku: true },
    }),
    db.customer.findMany({
      where: {
        OR: [
          { dni: { in: DEMO_CUSTOMERS.flatMap((c) => (c.documentType === "DNI" ? [c.dni] : [])) } },
          { ruc: { in: DEMO_CUSTOMERS.flatMap((c) => (c.documentType === "RUC" ? [c.ruc] : [])) } },
        ],
      },
      select: { id: true, dni: true, ruc: true },
    }),
  ]);

  const productBySku = new Map(products.map((p) => [p.sku, p.id]));
  const customerByDocument = new Map(
    customers.map((c) => [c.dni ?? c.ruc ?? "", c.id]),
  );

  const productIds = DEMO_PRODUCTS.map((p) => productBySku.get(p.sku));
  const customerIds = DEMO_CUSTOMERS.map((c) =>
    customerByDocument.get(c.documentType === "DNI" ? c.dni : c.ruc),
  );

  // Si alguien borró un producto o cliente del catálogo, se restaura todo.
  if (productIds.includes(undefined) || customerIds.includes(undefined)) {
    return restoreCatalog(db);
  }

  return {
    productIds: productIds as string[],
    customerIds: customerIds as string[],
  };
}

/**
 * Guarda las ventas planificadas con sus líneas, en orden cronológico, y
 * las devuelve con su id para registrar sus salidas en el kárdex.
 */
async function insertSales(
  db: PrismaClient,
  planned: PlannedSale[],
  { productIds, customerIds }: CatalogIds,
): Promise<DemoKardexSale[]> {
  if (planned.length === 0) return [];

  const inserted: DemoKardexSale[] = [];
  const sales: Prisma.SaleCreateManyInput[] = [];
  const items: Prisma.SaleItemCreateManyInput[] = [];

  for (const sale of planned) {
    const saleId = randomUUID();
    inserted.push({ id: saleId, createdAt: sale.createdAt, items: sale.items });
    const lines = sale.items.map(({ productIndex, quantity }) => ({
      product: DEMO_PRODUCTS[productIndex],
      productId: productIds[productIndex],
      quantity,
    }));
    const tax = computeSaleTax(
      lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: Number(line.product.price),
      })),
    );

    sales.push({
      id: saleId,
      customerId:
        sale.customerIndex === null ? null : customerIds[sale.customerIndex],
      taxableAmount: (tax.taxable / 100).toFixed(2),
      igvAmount: (tax.igv / 100).toFixed(2),
      total: (tax.total / 100).toFixed(2),
      status: "COMPLETADA",
      createdAt: sale.createdAt,
    });

    for (const line of lines) {
      items.push({
        saleId,
        productId: line.productId,
        productName: line.product.name,
        unitPrice: line.product.price,
        listPrice: line.product.price,
        quantity: line.quantity,
        subtotal: (
          (Math.round(Number(line.product.price) * 100) * line.quantity) /
          100
        ).toFixed(2),
        createdAt: sale.createdAt,
      });
    }
  }

  // createMany respeta el orden: los números de venta crecen con la fecha.
  await db.$transaction([
    db.sale.createMany({ data: sales }),
    db.saleItem.createMany({ data: items }),
  ]);

  return inserted;
}

/**
 * Reemplaza el kárdex de los productos de la demo por uno calculado desde
 * el primer día de la historia: saldo inicial, reposiciones semanales y las
 * salidas de las ventas de ejemplo. Cada producto termina con el stock del
 * catálogo.
 */
async function rebuildDemoKardex(
  db: PrismaClient,
  sales: DemoKardexSale[],
  { productIds }: CatalogIds,
  now: Date,
) {
  const firstDay = firstHistoryDay(now);

  await replaceKardexBulk(
    db,
    DEMO_PRODUCTS.map((product, index) => ({
      productId: productIds[index],
      movements: planProductKardex(product, index, sales, firstDay, now),
    })),
  );
}

/**
 * Salidas de las ventas agregadas en una sincronización horaria. Si a un
 * producto no le alcanza el stock, primero entra una reposición que lo deja
 * con el stock del catálogo después de la venta.
 */
async function recordDemoSaleExits(
  db: PrismaClient,
  sales: DemoKardexSale[],
  { productIds }: CatalogIds,
) {
  if (sales.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const sale of sales) {
      for (const item of sale.items) {
        const product = DEMO_PRODUCTS[item.productIndex];
        const productId = productIds[item.productIndex];
        const current = await tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { stock: true },
        });

        if (current.stock < item.quantity) {
          await recordMovement(tx, {
            productId,
            type: "INGRESO",
            quantity: item.quantity - current.stock + product.stock,
            unitCost: demoProductCost(product),
            referenceType: "MANUAL",
            reason: "Reposición automática de la demo",
            occurredAt: sale.createdAt,
          });
        }

        await recordMovement(tx, {
          productId,
          type: "VENTA",
          quantity: item.quantity,
          referenceType: "SALE",
          referenceId: sale.id,
          occurredAt: sale.createdAt,
        });
      }
    }
  }, { timeout: BULK_TRANSACTION_TIMEOUT_MS, maxWait: 10_000 });
}

/**
 * Reinicio completo: restaura el catálogo, borra las ventas de ejemplo y las
 * vuelve a generar para las últimas semanas, hasta `now`.
 */
export async function resetDemoData(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<DemoSyncResult> {
  const ids = await restoreCatalog(db);

  await db.sale.deleteMany({ where: DEMO_SALE_WHERE });

  const sales = await insertSales(
    db,
    planDemoSales(firstHistoryDay(now), now),
    ids,
  );
  await rebuildDemoKardex(db, sales, ids, now);

  return { action: "reset", salesCreated: sales.length };
}

/**
 * Pensada para ejecutarse cada hora. El primer paso de cada día hace el
 * reinicio completo, así la historia siempre termina hoy; el resto solo
 * agrega las ventas de ejemplo que tocaban desde la última ejecución.
 */
export async function syncDemoData(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<DemoSyncResult> {
  const range = await db.sale.aggregate({
    where: DEMO_SALE_WHERE,
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  const oldest = range._min.createdAt;
  const newest = range._max.createdAt;

  if (
    !oldest ||
    !newest ||
    limaDateKey(oldest) !== limaDateKey(firstHistoryDay(now))
  ) {
    return resetDemoData(db, now);
  }

  const ids = await readCatalogIds(db);
  const sales = await insertSales(
    db,
    planDemoSales(startOfLimaDay(newest), now, newest),
    ids,
  );
  await recordDemoSaleExits(db, sales, ids);

  return { action: "append", salesCreated: sales.length };
}
