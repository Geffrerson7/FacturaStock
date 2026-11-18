/**
 * Kárdex de la demo: saldo inicial, reposiciones semanales a costos que
 * varían un poco y una salida por cada línea de las ventas de ejemplo.
 *
 * Se calcula hacia atrás desde el stock del catálogo, para que al terminar
 * la historia cada producto quede exactamente con el stock del catálogo (y
 * el dashboard siga mostrando productos agotados y con stock bajo), sin que
 * el saldo sea negativo en ningún momento.
 */

import type { BulkMovement } from "@/src/lib/kardex/bulk";
import { roundCost, toDecimal } from "@/src/lib/kardex/calc";
import { addDays } from "@/src/lib/lima-time";

import type { DemoProduct } from "./catalog";

/** Días entre reposiciones. */
export const DEMO_RESTOCK_DAYS = 7;

/** Hora de las reposiciones: antes de abrir la tienda (08:00 en Lima). */
const RESTOCK_OFFSET_MS = 8 * 60 * 60 * 1000;

function hashString(value: string): number {
  let hash = 0x811c9dc5;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Costo de compra de un producto de la demo: entre el 60 % y el 78 % del
 * precio de venta sin IGV, según su SKU.
 */
export function demoProductCost(product: Pick<DemoProduct, "sku" | "price">) {
  const factor = 0.6 + (hashString(product.sku) % 19) / 100;
  const withoutIgv = toDecimal(product.price).div(1.18);

  return roundCost(withoutIgv.mul(factor)).toDecimalPlaces(2);
}

/** Costo de la reposición `week`: el costo base ±4 %. */
export function demoRestockCost(
  product: Pick<DemoProduct, "sku" | "price">,
  week: number,
) {
  const variation = ((hashString(product.sku) + week * 3) % 9) - 4;

  return demoProductCost(product)
    .mul(1 + variation / 100)
    .toDecimalPlaces(2);
}

export type DemoKardexSale = {
  id: string;
  createdAt: Date;
  items: { productIndex: number; quantity: number }[];
};

type Event =
  | { kind: "sale"; at: Date; quantity: number; saleId: string }
  | { kind: "restock"; at: Date; week: number };

/**
 * Movimientos de un producto entre `firstDay` (medianoche de Lima) y `now`.
 * `sales` debe venir en orden cronológico.
 */
export function planProductKardex(
  product: DemoProduct,
  productIndex: number,
  sales: DemoKardexSale[],
  firstDay: Date,
  now: Date,
): BulkMovement[] {
  const events: Event[] = [];

  for (
    let week = 1, at = addDays(firstDay, DEMO_RESTOCK_DAYS);
    at <= now;
    week += 1, at = addDays(at, DEMO_RESTOCK_DAYS)
  ) {
    events.push({
      kind: "restock",
      at: new Date(at.getTime() + RESTOCK_OFFSET_MS),
      week,
    });
  }

  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productIndex !== productIndex) continue;
      events.push({
        kind: "sale",
        at: sale.createdAt,
        quantity: item.quantity,
        saleId: sale.id,
      });
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Hacia atrás: el saldo final es el stock del catálogo. Cada reposición
  // trae lo que se vendió hasta la siguiente, sin dejar el saldo negativo.
  const restockQuantity = new Map<number, number>();
  let balance = product.stock;
  let soldSinceRestock = 0;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.kind === "sale") {
      balance += event.quantity;
      soldSinceRestock += event.quantity;
    } else {
      const quantity = Math.min(soldSinceRestock, balance);
      restockQuantity.set(index, quantity);
      balance -= quantity;
      soldSinceRestock = 0;
    }
  }

  const movements: BulkMovement[] = [];

  if (balance > 0) {
    movements.push({
      type: "SALDO_INICIAL",
      quantity: balance,
      unitCost: demoProductCost(product),
      occurredAt: new Date(firstDay.getTime() + RESTOCK_OFFSET_MS - 60 * 60 * 1000),
      referenceType: "MANUAL",
      reason: "Saldo inicial de la demo",
    });
  }

  events.forEach((event, index) => {
    if (event.kind === "sale") {
      movements.push({
        type: "VENTA",
        quantity: event.quantity,
        occurredAt: event.at,
        referenceType: "SALE",
        referenceId: event.saleId,
      });
      return;
    }

    const quantity = restockQuantity.get(index) ?? 0;
    if (quantity === 0) return;

    movements.push({
      type: "INGRESO",
      quantity,
      unitCost: demoRestockCost(product, event.week),
      occurredAt: event.at,
      referenceType: "MANUAL",
      reason: "Reposición semanal de la demo",
    });
  });

  return movements;
}
