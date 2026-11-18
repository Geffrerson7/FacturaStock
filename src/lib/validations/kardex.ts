import { z } from "zod";

import {
  KARDEX_VIEW_MODES,
  MANUAL_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPES,
} from "@/src/lib/kardex/catalog";

import { emptyToUndefined, optionalEnum, paginationQuery } from "./list";
import { unitCostField } from "./product";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de calendario AAAA-MM-DD (en la hora de Lima). */
function dateKey(message: string) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string(message)
      .regex(DATE_KEY, message)
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), message)
      .optional(),
  );
}

const productId = z.uuid("Selecciona un producto válido.");

const rangeFields = {
  productId,
  from: dateKey("La fecha inicial debe tener el formato AAAA-MM-DD."),
  to: dateKey("La fecha final debe tener el formato AAAA-MM-DD."),
  type: optionalEnum(
    STOCK_MOVEMENT_TYPES,
    "El tipo de movimiento no es válido.",
  ),
};

function validRange(value: { from?: string; to?: string }) {
  return !value.from || !value.to || value.from <= value.to;
}

const RANGE_MESSAGE = {
  message: "La fecha inicial no puede ser posterior a la final.",
  path: ["from"],
};

export const kardexQuerySchema = z
  .object({ ...rangeFields, ...paginationQuery })
  .refine(validRange, RANGE_MESSAGE);

export const kardexExportQuerySchema = z
  .object({
    ...rangeFields,
    mode: z.preprocess(
      emptyToUndefined,
      z
        .enum(KARDEX_VIEW_MODES, "El modo debe ser fisico o valorizado.")
        .default("valorizado"),
    ),
  })
  .refine(validRange, RANGE_MESSAGE);

export const MAX_MOVEMENT_QUANTITY = 1000000;

export const createMovementSchema = z
  .object({
    productId,
    type: z.enum(
      MANUAL_MOVEMENT_TYPES,
      "Elige un tipo de movimiento válido.",
    ),
    quantity: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce
        .number("La cantidad debe ser un número válido.")
        .int("La cantidad debe ser un número entero.")
        .min(1, "La cantidad debe ser al menos 1.")
        .max(MAX_MOVEMENT_QUANTITY, "La cantidad es demasiado alta.")
        .optional(),
    ),
    unitCost: unitCostField,
    reason: z
      .string("El motivo es obligatorio.")
      .trim()
      .min(3, "Escribe el motivo del movimiento (al menos 3 caracteres).")
      .max(255, "El motivo no puede superar los 255 caracteres."),
  })
  .superRefine((value, ctx) => {
    if (value.type === "AJUSTE_VALORIZACION") {
      if (value.unitCost === null) {
        ctx.addIssue({
          code: "custom",
          path: ["unitCost"],
          message: "Indica el nuevo costo unitario.",
        });
      }
      return;
    }

    if (value.quantity === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "La cantidad es obligatoria.",
      });
    }
  });

export const initialCostSchema = z.object({
  unitCost: z.coerce
    .number("El costo debe ser un número válido.")
    .min(0, "El costo no puede ser negativo.")
    .max(99999999, "El costo es demasiado alto.")
    .transform((value) => Math.round(value * 1e6) / 1e6),
});

export type KardexQuery = z.infer<typeof kardexQuerySchema>;
export type KardexExportQuery = z.infer<typeof kardexExportQuerySchema>;
export type CreateMovementInput = z.infer<typeof createMovementSchema>;
