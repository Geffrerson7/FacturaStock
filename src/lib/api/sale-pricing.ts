import { ApiError } from "./errors";
import { formatCents } from "@/src/lib/format";
import { toCents } from "@/src/lib/tax";

type PricedProduct = {
  name: string;
  /** Precio de lista con IGV. */
  price: { toString(): string };
  /** Precio mínimo con IGV. Sin valor, el mínimo es el de lista. */
  minPrice?: { toString(): string } | null;
};

export type SaleLineRequest = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type PricedSaleLine = {
  productId: string;
  priceCents: number;
  quantity: number;
};

/**
 * Precio cobrado por línea: el que manda el vendedor o, si no manda ninguno,
 * el de lista. Nunca por debajo del mínimo del producto. Las líneas del mismo
 * producto y el mismo precio se juntan en una sola, en el orden de llegada.
 */
export function priceSaleLines(
  items: SaleLineRequest[],
  productById: Map<string, PricedProduct>,
): PricedSaleLine[] {
  const lines = new Map<string, PricedSaleLine>();

  for (const item of items) {
    const product = productById.get(item.productId);

    if (!product) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Uno de los productos seleccionados ya no existe.",
        { field: "items" },
      );
    }

    const listCents = toCents(Number(product.price.toString()));
    const priceCents =
      item.unitPrice === undefined ? listCents : toCents(item.unitPrice);
    const minCents =
      product.minPrice == null
        ? listCents
        : toCents(Number(product.minPrice.toString()));

    if (priceCents < minCents) {
      throw new ApiError(
        409,
        "PRICE_BELOW_MINIMUM",
        `El precio de "${product.name}" (${formatCents(priceCents)}) está por debajo del mínimo permitido (${formatCents(minCents)}).`,
        { field: "items" },
      );
    }

    const key = `${item.productId}:${priceCents}`;
    const line = lines.get(key);

    if (line) {
      line.quantity += item.quantity;
    } else {
      lines.set(key, { productId: item.productId, priceCents, quantity: item.quantity });
    }
  }

  return [...lines.values()];
}
