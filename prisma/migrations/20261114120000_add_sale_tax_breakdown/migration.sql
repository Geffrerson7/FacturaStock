-- Desglose de la venta: base imponible e IGV (el total ya existía).
ALTER TABLE "sales"
  ADD COLUMN "taxable_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "igv_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Ventas existentes: mismo cálculo que se envía a Nubefact. El valor unitario
-- sin IGV se redondea a dos decimales por línea y el IGV es la diferencia con
-- el total, de modo que base + IGV = total en todas las filas.
UPDATE "sales" AS s
SET
  "taxable_amount" = t.base,
  "igv_amount" = s."total" - t.base
FROM (
  SELECT
    "sale_id",
    SUM(ROUND("unit_price" / 1.18, 2) * "quantity") AS base
  FROM "sale_items"
  GROUP BY "sale_id"
) AS t
WHERE t."sale_id" = s."id";
