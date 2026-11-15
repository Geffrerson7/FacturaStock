import { addDays, limaDateKey, limaMidnight } from "@/src/lib/lima-time";

import { DEMO_CUSTOMERS, DEMO_PRODUCTS } from "./catalog";

/** Semanas de historia que tiene la demo, contando el día de hoy. */
export const DEMO_HISTORY_DAYS = 42;

/** Horario de la tienda, en minutos desde la medianoche de Lima. */
const OPENING_MINUTE = 9 * 60;
const CLOSING_MINUTE = 21 * 60;

export type PlannedSale = {
  createdAt: Date;
  /** `null` es una venta sin cliente (boleta a «Clientes varios»). */
  customerIndex: number | null;
  items: { productIndex: number; quantity: number }[];
};

/** Generador pseudoaleatorio con semilla (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a de 32 bits: la semilla de cada día sale de su fecha. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

const TOTAL_POPULARITY = DEMO_PRODUCTS.reduce(
  (sum, product) => sum + product.popularity,
  0,
);

function pickProductIndex(random: () => number): number {
  let target = random() * TOTAL_POPULARITY;

  for (const [index, product] of DEMO_PRODUCTS.entries()) {
    target -= product.popularity;
    if (target < 0) return index;
  }

  return DEMO_PRODUCTS.length - 1;
}

const DNI_CUSTOMERS = [...DEMO_CUSTOMERS.keys()].filter(
  (index) => DEMO_CUSTOMERS[index].documentType === "DNI",
);
const RUC_CUSTOMERS = [...DEMO_CUSTOMERS.keys()].filter(
  (index) => DEMO_CUSTOMERS[index].documentType === "RUC",
);

/** Ventas por día de la semana (domingo = 0): más movimiento el fin de semana. */
const SALES_PER_WEEKDAY: [min: number, max: number][] = [
  [4, 7],
  [5, 8],
  [5, 8],
  [5, 9],
  [6, 9],
  [8, 12],
  [9, 14],
];

/** Ventas de un día (AAAA-MM-DD de Lima), ordenadas por hora. */
export function planDemoDay(dateKey: string): PlannedSale[] {
  const random = createRandom(hashString(dateKey));
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  const [min, max] = SALES_PER_WEEKDAY[weekday];
  const count = randomInt(random, min, max);
  const midnight = limaMidnight(dateKey).getTime();

  const seconds = Array.from({ length: count }, () =>
    randomInt(random, OPENING_MINUTE * 60, CLOSING_MINUTE * 60 - 1),
  ).sort((a, b) => a - b);

  return seconds.map((second) => {
    const roll = random();
    const customerIndex =
      roll < 0.6
        ? null
        : roll < 0.9
          ? DNI_CUSTOMERS[randomInt(random, 0, DNI_CUSTOMERS.length - 1)]
          : RUC_CUSTOMERS[randomInt(random, 0, RUC_CUSTOMERS.length - 1)];
    const isBusiness =
      customerIndex !== null &&
      DEMO_CUSTOMERS[customerIndex].documentType === "RUC";

    // Productos distintos en cada venta; las empresas compran más unidades.
    const lineCount = randomInt(random, 1, isBusiness ? 5 : 4);
    const productIndexes = new Set<number>();
    while (productIndexes.size < lineCount) {
      productIndexes.add(pickProductIndex(random));
    }

    return {
      createdAt: new Date(midnight + second * 1000),
      customerIndex,
      items: [...productIndexes].map((productIndex) => ({
        productIndex,
        quantity: isBusiness
          ? randomInt(random, 3, 12)
          : random() < 0.7
            ? 1
            : randomInt(random, 2, 3),
      })),
    };
  });
}

/** Ventas de ejemplo con fecha en `(after, until]`, día por día. */
export function planDemoSales(
  firstDay: Date,
  until: Date,
  after?: Date,
): PlannedSale[] {
  const sales: PlannedSale[] = [];
  const lastKey = limaDateKey(until);

  for (let day = firstDay; ; day = addDays(day, 1)) {
    const key = limaDateKey(day);

    for (const sale of planDemoDay(key)) {
      if (sale.createdAt > until) break;
      if (after && sale.createdAt <= after) continue;
      sales.push(sale);
    }

    if (key >= lastKey) break;
  }

  return sales;
}
