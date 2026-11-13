import { describe, expect, it } from "vitest";

import { ApiError } from "@/src/lib/api/errors";
import {
  buildNubefactItems,
  formatNubefactDate,
  resolveInvoiceIdentity,
  type InvoiceCustomer,
} from "@/src/lib/nubefact";

function dniCustomer(
  overrides: Partial<InvoiceCustomer> = {},
): InvoiceCustomer {
  return {
    documentType: "DNI",
    dni: "46027897",
    ruc: null,
    firstName: "Ana",
    lastName: "Pérez",
    businessName: null,
    address: "Av. Lima 123",
    email: null,
    ...overrides,
  };
}

function rucCustomer(
  overrides: Partial<InvoiceCustomer> = {},
): InvoiceCustomer {
  return {
    documentType: "RUC",
    dni: null,
    ruc: "20601030013",
    firstName: null,
    lastName: null,
    businessName: "EMPRESA DE PRUEBA S.A.C.",
    address: "Av. Javier Prado 456",
    email: "facturas@empresa.pe",
    ...overrides,
  };
}

describe("resolveInvoiceIdentity", () => {
  it("emite boleta para un cliente con DNI", () => {
    const identity = resolveInvoiceIdentity(dniCustomer());

    expect(identity).toMatchObject({
      documentType: "BOLETA",
      invoiceType: 2,
      series: "BBB1",
      initialNumber: 6,
      customerDocumentType: "1",
      customerDocumentNumber: "46027897",
      customerName: "Ana Pérez",
      customerAddress: "Av. Lima 123",
      customerEmail: null,
    });
  });

  it("emite factura para un cliente con RUC", () => {
    const identity = resolveInvoiceIdentity(rucCustomer());

    expect(identity).toMatchObject({
      documentType: "FACTURA",
      invoiceType: 1,
      series: "FFF1",
      initialNumber: 8,
      customerDocumentType: "6",
      customerDocumentNumber: "20601030013",
      customerName: "EMPRESA DE PRUEBA S.A.C.",
      customerAddress: "Av. Javier Prado 456",
      customerEmail: "facturas@empresa.pe",
    });
  });

  it("trata al cliente walk-in (DNI 00000000) como clientes varios", () => {
    const identity = resolveInvoiceIdentity(
      dniCustomer({ dni: "00000000", firstName: "Walk-in" }),
    );

    expect(identity).toMatchObject({
      documentType: "BOLETA",
      customerDocumentType: "-",
      customerDocumentNumber: "0",
      customerName: "CLIENTES VARIOS",
      customerAddress: "-",
      customerEmail: null,
    });
  });

  it("trata una venta sin cliente como clientes varios", () => {
    expect(resolveInvoiceIdentity(null)).toMatchObject({
      documentType: "BOLETA",
      customerDocumentType: "-",
      customerDocumentNumber: "0",
      customerName: "CLIENTES VARIOS",
    });
  });

  it("rechaza un cliente RUC sin número de RUC", () => {
    expect(() => resolveInvoiceIdentity(rucCustomer({ ruc: null }))).toThrow(
      ApiError,
    );

    try {
      resolveInvoiceIdentity(rucCustomer({ ruc: null }));
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 400,
        code: "VALIDATION_ERROR",
        field: "customerId",
      });
    }
  });

  it("recorta la razón social y la dirección a 100 caracteres", () => {
    const identity = resolveInvoiceIdentity(
      rucCustomer({
        businessName: "A".repeat(150),
        address: "B".repeat(150),
      }),
    );

    expect(identity.customerName).toHaveLength(100);
    expect(identity.customerAddress).toHaveLength(100);
  });

  it("usa un guion cuando el cliente no tiene dirección", () => {
    const identity = resolveInvoiceIdentity(dniCustomer({ address: "" }));

    expect(identity.customerAddress).toBe("-");
  });
});

describe("buildNubefactItems", () => {
  it("desglosa base imponible e IGV de una línea", () => {
    const result = buildNubefactItems([
      { description: "Agua mineral 500 ml", quantity: 2, unitPrice: 2.5 },
    ]);

    expect(result.items).toEqual([
      {
        unidad_de_medida: "NIU",
        descripcion: "Agua mineral 500 ml",
        cantidad: 2,
        valor_unitario: 2.12,
        precio_unitario: 2.5,
        subtotal: 4.24,
        tipo_de_igv: 1,
        igv: 0.76,
        total: 5,
        anticipo_regularizacion: false,
      },
    ]);
    expect(result).toMatchObject({
      totalGravada: 4.24,
      totalIgv: 0.76,
      total: 5,
    });
  });

  it("cuadra precios con céntimos impares", () => {
    const result = buildNubefactItems([
      { description: "Producto", quantity: 1, unitPrice: 0.99 },
    ]);

    expect(result.items[0]).toMatchObject({
      valor_unitario: 0.84,
      subtotal: 0.84,
      igv: 0.15,
      total: 0.99,
    });
    expect(result.totalGravada + result.totalIgv).toBeCloseTo(result.total, 2);
  });

  it("cuadra cantidades grandes sin perder céntimos", () => {
    const result = buildNubefactItems([
      { description: "Caja", quantity: 1000, unitPrice: 1234.56 },
    ]);

    expect(result.items[0]).toMatchObject({
      valor_unitario: 1046.24,
      subtotal: 1046240,
      igv: 188320,
      total: 1234560,
    });
    expect(result).toMatchObject({
      totalGravada: 1046240,
      totalIgv: 188320,
      total: 1234560,
    });
  });

  it("suma varias líneas en céntimos y mantiene total = base + IGV", () => {
    const result = buildNubefactItems([
      { description: "A", quantity: 3, unitPrice: 10.1 },
      { description: "B", quantity: 7, unitPrice: 1.15 },
      { description: "C", quantity: 13, unitPrice: 0.99 },
    ]);

    const itemTotal = result.items.reduce(
      (sum, item) => sum + Math.round(item.total * 100),
      0,
    );

    expect(itemTotal).toBe(Math.round(result.total * 100));
    expect(
      Math.round(result.totalGravada * 100) + Math.round(result.totalIgv * 100),
    ).toBe(Math.round(result.total * 100));
  });

  it("recorta la descripción a 250 caracteres y quita espacios", () => {
    const result = buildNubefactItems([
      {
        description: `  ${"x".repeat(300)}  `,
        quantity: 1,
        unitPrice: 1,
      },
    ]);

    expect(result.items[0]?.descripcion).toHaveLength(250);
    expect(result.items[0]?.descripcion.startsWith("x")).toBe(true);
  });

  it("devuelve totales en cero sin líneas", () => {
    expect(buildNubefactItems([])).toEqual({
      items: [],
      totalGravada: 0,
      totalIgv: 0,
      total: 0,
    });
  });
});

describe("formatNubefactDate", () => {
  it("formatea con el día de Lima, no con UTC", () => {
    expect(formatNubefactDate(new Date("2026-11-13T12:00:00Z"))).toBe(
      "13-11-2026",
    );

    // 02:00 UTC del 14 sigue siendo 21:00 del 13 en Lima (UTC-5).
    expect(formatNubefactDate(new Date("2026-11-14T02:00:00Z"))).toBe(
      "13-11-2026",
    );
  });

  it("usa ceros a la izquierda en día y mes", () => {
    expect(formatNubefactDate(new Date("2026-01-01T05:00:00Z"))).toBe(
      "01-01-2026",
    );
  });

  it("respeta el cambio de año en Lima", () => {
    expect(formatNubefactDate(new Date("2025-12-31T23:00:00Z"))).toBe(
      "31-12-2025",
    );
    expect(formatNubefactDate(new Date("2026-01-01T04:59:00Z"))).toBe(
      "31-12-2025",
    );
  });
});
