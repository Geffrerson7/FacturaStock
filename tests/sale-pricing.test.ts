import { describe, expect, it } from "vitest";

import { ApiError } from "@/src/lib/api/errors";
import { priceSaleLines } from "@/src/lib/api/sale-pricing";
import { createSaleSchema } from "@/src/lib/validations/sale";
import {
  createProductSchema,
  updateProductSchema,
} from "@/src/lib/validations/product";

const TABLE = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const CHAIR = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

const products = new Map([
  [TABLE, { name: "Mesa de comedor", price: "2800.00", minPrice: "2300.00" }],
  [CHAIR, { name: "Silla en acero", price: "500.00", minPrice: null }],
]);

function expectApiError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    return error as ApiError;
  }
  throw new Error(`Se esperaba el error ${code}`);
}

describe("priceSaleLines", () => {
  it("usa el precio de lista cuando no llega precio", () => {
    expect(priceSaleLines([{ productId: TABLE, quantity: 1 }], products)).toEqual([
      { productId: TABLE, priceCents: 280000, quantity: 1 },
    ]);
  });

  it("acepta un precio entre el mínimo y el de lista, y uno mayor al de lista", () => {
    expect(
      priceSaleLines(
        [
          { productId: TABLE, quantity: 1, unitPrice: 2300 },
          { productId: CHAIR, quantity: 2, unitPrice: 650.5 },
        ],
        products,
      ),
    ).toEqual([
      { productId: TABLE, priceCents: 230000, quantity: 1 },
      { productId: CHAIR, priceCents: 65050, quantity: 2 },
    ]);
  });

  it("rechaza un precio por debajo del mínimo", () => {
    const error = expectApiError(
      () =>
        priceSaleLines([{ productId: TABLE, quantity: 1, unitPrice: 2299.99 }], products),
      "PRICE_BELOW_MINIMUM",
    );
    expect(error.status).toBe(409);
  });

  it("sin precio mínimo, el mínimo es el precio de lista", () => {
    expectApiError(
      () => priceSaleLines([{ productId: CHAIR, quantity: 1, unitPrice: 499.99 }], products),
      "PRICE_BELOW_MINIMUM",
    );
  });

  it("junta las líneas del mismo producto y precio, y separa las de otro precio", () => {
    expect(
      priceSaleLines(
        [
          { productId: TABLE, quantity: 1, unitPrice: 2500 },
          { productId: TABLE, quantity: 2, unitPrice: 2500 },
          { productId: TABLE, quantity: 1 },
        ],
        products,
      ),
    ).toEqual([
      { productId: TABLE, priceCents: 250000, quantity: 3 },
      { productId: TABLE, priceCents: 280000, quantity: 1 },
    ]);
  });
});

describe("validaciones de precio", () => {
  const product = {
    name: "Mesa",
    sku: "MESA-1",
    price: 2800,
    stock: 0,
    categoryId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  };

  it("el precio mínimo es opcional y vacío queda en null", () => {
    expect(createProductSchema.parse(product).minPrice).toBeNull();
    expect(createProductSchema.parse({ ...product, minPrice: "" }).minPrice).toBeNull();
    expect(createProductSchema.parse({ ...product, minPrice: "2300" }).minPrice).toBe(2300);
  });

  it("el precio mínimo no puede superar al precio", () => {
    const result = updateProductSchema.safeParse({ ...product, minPrice: 2800.01 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["minPrice"]);
  });

  it("el precio de una línea es opcional, positivo y con hasta 2 decimales", () => {
    const sale = (unitPrice: unknown) =>
      createSaleSchema.safeParse({
        items: [{ productId: TABLE, quantity: 1, unitPrice }],
      });

    expect(sale(undefined).success).toBe(true);
    expect(sale(null).success).toBe(true);
    expect(sale(2300.5).success).toBe(true);
    expect(sale(0).success).toBe(false);
    expect(sale(2300.555).success).toBe(false);
  });
});
