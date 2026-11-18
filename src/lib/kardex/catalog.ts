/**
 * Tipos de movimiento del kárdex y sus códigos SUNAT. No importa Prisma, así
 * que también se usa en los componentes del navegador.
 */

export const STOCK_MOVEMENT_TYPES = [
  "SALDO_INICIAL",
  "INGRESO",
  "AJUSTE_POSITIVO",
  "VENTA",
  "ANULACION_VENTA",
  "AJUSTE_NEGATIVO",
  "MERMA",
  "AJUSTE_VALORIZACION",
] as const;

export type StockMovementTypeKey = (typeof STOCK_MOVEMENT_TYPES)[number];

export type MovementDirection = "ENTRADA" | "SALIDA" | "NINGUNA";

export type StockReferenceTypeKey =
  | "MANUAL"
  | "SALE"
  | "SALE_CANCELLATION"
  | "PURCHASE";

type MovementTypeInfo = {
  label: string;
  direction: MovementDirection;
};

export const MOVEMENT_TYPE_INFO: Record<StockMovementTypeKey, MovementTypeInfo> =
  {
    SALDO_INICIAL: { label: "Saldo inicial", direction: "ENTRADA" },
    INGRESO: { label: "Ingreso de mercadería", direction: "ENTRADA" },
    AJUSTE_POSITIVO: { label: "Ajuste positivo", direction: "ENTRADA" },
    VENTA: { label: "Venta", direction: "SALIDA" },
    ANULACION_VENTA: { label: "Anulación de venta", direction: "ENTRADA" },
    AJUSTE_NEGATIVO: { label: "Ajuste negativo", direction: "SALIDA" },
    MERMA: { label: "Merma", direction: "SALIDA" },
    AJUSTE_VALORIZACION: {
      label: "Ajuste de valorización",
      direction: "NINGUNA",
    },
  };

/** Tipos que el usuario registra a mano desde "Registrar movimiento". */
export const MANUAL_MOVEMENT_TYPES = [
  "INGRESO",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "MERMA",
  "AJUSTE_VALORIZACION",
] as const satisfies readonly StockMovementTypeKey[];

export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

/** Tabla 12 de SUNAT: tipo de operación. Solo los códigos que se usan. */
export const SUNAT_OPERATION_LABELS: Record<string, string> = {
  "01": "Venta",
  "02": "Compra",
  "05": "Devolución recibida",
  "13": "Mermas",
  "16": "Saldo inicial",
  "99": "Otros",
};

/** Código de la tabla 12 de SUNAT para un movimiento. */
export function sunatOperationCode(
  type: StockMovementTypeKey,
  referenceType: StockReferenceTypeKey,
): string {
  switch (type) {
    case "SALDO_INICIAL":
      return "16";
    case "INGRESO":
      // Un ingreso manual no tiene comprobante de compra: "otros".
      return referenceType === "PURCHASE" ? "02" : "99";
    case "VENTA":
      return "01";
    case "ANULACION_VENTA":
      return "05";
    case "MERMA":
      return "13";
    case "AJUSTE_POSITIVO":
    case "AJUSTE_NEGATIVO":
    case "AJUSTE_VALORIZACION":
      return "99";
  }
}

/** Tabla 10 de SUNAT: tipo de comprobante. */
export const SUNAT_DOCUMENT_LABELS: Record<string, string> = {
  "00": "Otros",
  "01": "Factura",
  "03": "Boleta de venta",
};

/** Tabla 6 de SUNAT: unidad de medida. La misma que se envía a Nubefact. */
export const KARDEX_UNIT_OF_MEASURE = { code: "NIU", label: "Unidad" } as const;

/** Tabla 5 de SUNAT: tipo de existencia. */
export const KARDEX_EXISTENCE_TYPE = { code: "01", label: "Mercaderías" } as const;

export const KARDEX_VALUATION_METHOD = "Promedio ponderado";

export const KARDEX_VIEW_MODES = ["fisico", "valorizado"] as const;

export type KardexViewMode = (typeof KARDEX_VIEW_MODES)[number];
