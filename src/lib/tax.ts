/**
 * Cálculo del IGV de una venta. No depende del servidor, así que el
 * formulario de venta muestra exactamente el mismo desglose que se guarda en
 * la base y se envía a Nubefact.
 */

export const IGV_RATE = 0.18;

export type TaxableLine = {
  quantity: number;
  /** Precio unitario con IGV incluido. */
  unitPrice: number;
};

/** Importes de una línea, en céntimos para no acumular errores de coma flotante. */
export type LineTaxCents = {
  /** Valor unitario sin IGV. */
  unitValue: number;
  /** Precio unitario con IGV. */
  unitPrice: number;
  /** Base imponible de la línea. */
  taxable: number;
  igv: number;
  total: number;
};

export type SaleTaxCents = {
  taxable: number;
  igv: number;
  total: number;
};

export function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * El valor unitario se redondea a céntimos (así lo exige el comprobante) y el
 * IGV se obtiene por diferencia, de modo que base + IGV siempre da el total
 * con IGV de la línea, sin descuadres por redondeo.
 */
export function computeLineTax({ quantity, unitPrice }: TaxableLine): LineTaxCents {
  const priceCents = toCents(unitPrice);
  const total = priceCents * quantity;
  const unitValue = Math.round(priceCents / (1 + IGV_RATE));
  const taxable = unitValue * quantity;

  return { unitValue, unitPrice: priceCents, taxable, igv: total - taxable, total };
}

export function computeSaleTax(lines: TaxableLine[]): SaleTaxCents {
  return lines.map(computeLineTax).reduce(
    (sum, line) => ({
      taxable: sum.taxable + line.taxable,
      igv: sum.igv + line.igv,
      total: sum.total + line.total,
    }),
    { taxable: 0, igv: 0, total: 0 },
  );
}
