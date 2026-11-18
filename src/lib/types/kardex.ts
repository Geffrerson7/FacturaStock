import type {
  MovementDirection,
  StockMovementTypeKey,
  StockReferenceTypeKey,
} from "@/src/lib/kardex/catalog";
import type { PaginationMeta } from "./pagination";

/** Importes y costos llegan como texto, igual que los Decimal de Prisma. */
export type KardexBalanceDto = {
  quantity: number;
  averageCost: string;
  value: string;
};

export type StockMovement = {
  id: string;
  sequence: number;
  type: StockMovementTypeKey;
  direction: MovementDirection;
  sunatOperationCode: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
  balanceQuantity: number;
  balanceAverageCost: string;
  balanceValue: string;
  documentType: string;
  documentSeries: string | null;
  documentNumber: number | null;
  referenceType: StockReferenceTypeKey;
  referenceId: string | null;
  reason: string | null;
  occurredAt: string;
  user: { name: string } | null;
};

export type KardexTotals = {
  entries: { quantity: number; value: string };
  exits: { quantity: number; value: string };
};

export type KardexProduct = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  lastCost: string;
  averageCost: string;
  inventoryValue: string;
  isActive: boolean;
};

export type KardexReport = {
  product: KardexProduct;
  range: { from: string; to: string };
  /** Saldo al empezar el rango (último movimiento anterior). */
  opening: KardexBalanceDto;
  /** Saldo al terminar el rango. */
  closing: KardexBalanceDto;
  totals: KardexTotals;
  /** El único movimiento es el saldo inicial: su costo se puede corregir. */
  canEditInitialCost: boolean;
  movements: StockMovement[];
};

export type KardexResponse = {
  data: KardexReport;
  pagination: PaginationMeta;
};
