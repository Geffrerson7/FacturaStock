/**
 * Cálculo del kárdex valorizado por costo promedio ponderado. Funciones
 * puras: no leen ni escriben la base, así se prueban sin Prisma y las usan
 * igual el motor (`engine.ts`), la reconstrucción y los datos de la demo.
 *
 * Reglas:
 * - Entrada: suma unidades y valor; el promedio pasa a ser valor / unidades.
 * - Salida: sale al promedio vigente y no cambia el promedio.
 * - Al llegar a 0 unidades el valor se fuerza a 0, sin céntimos residuales.
 *   El promedio se conserva para valorizar el siguiente ajuste positivo.
 * - Ajuste de valorización: no mueve unidades; fija un nuevo costo promedio
 *   y el valor pasa a ser unidades × ese costo.
 */

import { Prisma } from "@/src/generated/prisma/client";

import type { MovementDirection } from "./catalog";

export type Decimal = Prisma.Decimal;
export type DecimalLike = Prisma.Decimal | number | string;

/** Decimales del costo unitario y del promedio. Los importes llevan 2. */
export const COST_DECIMALS = 6;

export function toDecimal(value: DecimalLike | null | undefined): Decimal {
  return new Prisma.Decimal(value === null || value === undefined ? 0 : value);
}

export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundCost(value: Decimal): Decimal {
  return value.toDecimalPlaces(COST_DECIMALS, Prisma.Decimal.ROUND_HALF_UP);
}

export type KardexBalance = {
  quantity: number;
  averageCost: Decimal;
  value: Decimal;
};

export const EMPTY_BALANCE: KardexBalance = {
  quantity: 0,
  averageCost: toDecimal(0),
  value: toDecimal(0),
};

export type MovementCalcInput =
  | { kind: "entry"; quantity: number; unitCost: DecimalLike }
  | { kind: "exit"; quantity: number }
  | { kind: "revaluation"; unitCost: DecimalLike };

export type MovementCalcResult = {
  direction: MovementDirection;
  quantity: number;
  unitCost: Decimal;
  /** Con signo en un ajuste de valorización; positivo en el resto. */
  totalCost: Decimal;
  balance: KardexBalance;
};

export class InsufficientStockError extends Error {
  readonly available: number;
  readonly requested: number;

  constructor(available: number, requested: number) {
    super(
      `No hay stock suficiente. Disponible: ${available}, solicitado: ${requested}.`,
    );
    this.name = "InsufficientStockError";
    this.available = available;
    this.requested = requested;
  }
}

/** Datos imposibles (cantidad 0, costo negativo...). Es un error de programación o de validación. */
export class KardexInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KardexInputError";
  }
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new KardexInputError("La cantidad debe ser un entero mayor que 0.");
  }
}

function assertCost(cost: Decimal) {
  if (cost.isNaN() || cost.isNegative()) {
    throw new KardexInputError("El costo unitario no puede ser negativo.");
  }
}

/** Aplica un movimiento a un saldo y devuelve la fila resultante. */
export function applyMovement(
  balance: KardexBalance,
  input: MovementCalcInput,
): MovementCalcResult {
  if (input.kind === "entry") {
    assertQuantity(input.quantity);
    const unitCost = roundCost(toDecimal(input.unitCost));
    assertCost(unitCost);

    const totalCost = roundMoney(unitCost.mul(input.quantity));
    const quantity = balance.quantity + input.quantity;
    const value = balance.value.add(totalCost);

    return {
      direction: "ENTRADA",
      quantity: input.quantity,
      unitCost,
      totalCost,
      balance: {
        quantity,
        averageCost: roundCost(value.div(quantity)),
        value,
      },
    };
  }

  if (input.kind === "exit") {
    assertQuantity(input.quantity);

    if (input.quantity > balance.quantity) {
      throw new InsufficientStockError(balance.quantity, input.quantity);
    }

    const quantity = balance.quantity - input.quantity;
    // La última unidad se lleva todo el valor que queda: el saldo en 0
    // unidades vale exactamente 0.
    const totalCost =
      quantity === 0
        ? balance.value
        : roundMoney(balance.averageCost.mul(input.quantity));

    return {
      direction: "SALIDA",
      quantity: input.quantity,
      unitCost: balance.averageCost,
      totalCost,
      balance: {
        quantity,
        averageCost: balance.averageCost,
        value: quantity === 0 ? toDecimal(0) : balance.value.sub(totalCost),
      },
    };
  }

  const unitCost = roundCost(toDecimal(input.unitCost));
  assertCost(unitCost);

  if (balance.quantity === 0) {
    throw new KardexInputError(
      "No se puede revalorizar un producto sin stock.",
    );
  }

  const value = roundMoney(unitCost.mul(balance.quantity));

  return {
    direction: "NINGUNA",
    quantity: 0,
    unitCost,
    totalCost: value.sub(balance.value),
    balance: { quantity: balance.quantity, averageCost: unitCost, value },
  };
}

/** Aplica una lista de movimientos en orden y devuelve cada fila. */
export function replayMovements(
  inputs: MovementCalcInput[],
  start: KardexBalance = EMPTY_BALANCE,
): MovementCalcResult[] {
  const results: MovementCalcResult[] = [];
  let balance = start;

  for (const input of inputs) {
    const result = applyMovement(balance, input);
    results.push(result);
    balance = result.balance;
  }

  return results;
}

/**
 * Movimiento ya guardado, con lo necesario para recalcularlo. `reversesIndex`
 * es la posición, en la misma lista, de la salida que revierte.
 */
export type StoredMovementInput = {
  type:
    | "SALDO_INICIAL"
    | "INGRESO"
    | "AJUSTE_POSITIVO"
    | "VENTA"
    | "ANULACION_VENTA"
    | "AJUSTE_NEGATIVO"
    | "MERMA"
    | "AJUSTE_VALORIZACION";
  quantity: number;
  unitCost: DecimalLike;
  reversesIndex?: number | null;
};

/**
 * Recalcula los saldos de un producto a partir de sus movimientos. Los
 * costos que dependen del saldo (salidas, ajustes positivos, anulaciones) se
 * vuelven a calcular; los que escribió el usuario (saldo inicial, ingresos,
 * revalorizaciones) se conservan.
 */
export function rebuildMovements(
  movements: StoredMovementInput[],
): MovementCalcResult[] {
  const results: MovementCalcResult[] = [];
  let balance = EMPTY_BALANCE;

  for (const movement of movements) {
    let input: MovementCalcInput;

    switch (movement.type) {
      case "SALDO_INICIAL":
      case "INGRESO":
        input = {
          kind: "entry",
          quantity: movement.quantity,
          unitCost: movement.unitCost,
        };
        break;
      case "AJUSTE_POSITIVO":
        input = {
          kind: "entry",
          quantity: movement.quantity,
          unitCost: balance.averageCost,
        };
        break;
      case "ANULACION_VENTA": {
        const reversed =
          movement.reversesIndex === null || movement.reversesIndex === undefined
            ? undefined
            : results[movement.reversesIndex];
        input = {
          kind: "entry",
          quantity: movement.quantity,
          unitCost: reversed?.unitCost ?? balance.averageCost,
        };
        break;
      }
      case "VENTA":
      case "AJUSTE_NEGATIVO":
      case "MERMA":
        input = { kind: "exit", quantity: movement.quantity };
        break;
      case "AJUSTE_VALORIZACION":
        input = { kind: "revaluation", unitCost: movement.unitCost };
        break;
    }

    const result = applyMovement(balance, input);
    results.push(result);
    balance = result.balance;
  }

  return results;
}
