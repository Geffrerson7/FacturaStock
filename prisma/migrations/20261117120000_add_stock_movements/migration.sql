-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('SALDO_INICIAL', 'INGRESO', 'AJUSTE_POSITIVO', 'VENTA', 'ANULACION_VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'AJUSTE_VALORIZACION');

-- CreateEnum
CREATE TYPE "StockMovementDirection" AS ENUM ('ENTRADA', 'SALIDA', 'NINGUNA');

-- CreateEnum
CREATE TYPE "StockReferenceType" AS ENUM ('MANUAL', 'SALE', 'SALE_CANCELLATION', 'PURCHASE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "average_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
ADD COLUMN     "inventory_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "last_cost" DECIMAL(14,6) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "direction" "StockMovementDirection" NOT NULL,
    "sunat_operation_code" VARCHAR(2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(14,6) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "balance_quantity" INTEGER NOT NULL,
    "balance_average_cost" DECIMAL(14,6) NOT NULL,
    "balance_value" DECIMAL(14,2) NOT NULL,
    "document_type" VARCHAR(2) NOT NULL DEFAULT '00',
    "document_series" VARCHAR(4),
    "document_number" INTEGER,
    "reference_type" "StockReferenceType" NOT NULL,
    "reference_id" UUID,
    "reverses_movement_id" UUID,
    "reason" VARCHAR(255),
    "user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_product_id_occurred_at_idx" ON "stock_movements"("product_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_product_id_sequence_key" ON "stock_movements"("product_id", "sequence");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reverses_movement_id_fkey" FOREIGN KEY ("reverses_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Corte limpio: el kárdex empieza hoy. Cada producto con stock recibe un
-- movimiento de saldo inicial (tabla 12 de SUNAT, código 16) a costo 0,
-- porque hasta ahora ningún producto tenía costo. El costo de ese saldo se
-- puede corregir después desde la aplicación.
INSERT INTO "stock_movements" (
    "id", "product_id", "sequence", "type", "direction", "sunat_operation_code",
    "quantity", "unit_cost", "total_cost",
    "balance_quantity", "balance_average_cost", "balance_value",
    "document_type", "reference_type", "reason"
)
SELECT
    gen_random_uuid(), "id", 1, 'SALDO_INICIAL', 'ENTRADA', '16',
    "stock", "last_cost", ROUND("stock" * "last_cost", 2),
    "stock", "last_cost", ROUND("stock" * "last_cost", 2),
    '00', 'MANUAL', 'Saldo inicial al activar el kárdex'
FROM "products"
WHERE "stock" > 0;

UPDATE "products"
SET "average_cost" = "last_cost",
    "inventory_value" = ROUND("stock" * "last_cost", 2)
WHERE "stock" > 0;
