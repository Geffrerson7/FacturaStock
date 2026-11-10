-- CreateEnum
CREATE TYPE "InvoiceDocumentType" AS ENUM ('FACTURA', 'BOLETA');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDIENTE', 'EMITIDO', 'ANULADO', 'ANULACION_PENDIENTE');

-- CreateTable
CREATE TABLE "invoice_counters" (
    "series" VARCHAR(4) NOT NULL,
    "next_number" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("series")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "document_type" "InvoiceDocumentType" NOT NULL,
    "invoice_type" INTEGER NOT NULL,
    "series" VARCHAR(4) NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDIENTE',
    "sunat_accepted" BOOLEAN,
    "sunat_description" TEXT,
    "sunat_note" TEXT,
    "sunat_response_code" VARCHAR(20),
    "pdf_url" TEXT,
    "xml_url" TEXT,
    "cdr_url" TEXT,
    "hash" VARCHAR(255),
    "qr_string" TEXT,
    "error_message" TEXT,
    "response" JSONB,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_sale_id_key" ON "invoices"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_series_number_key" ON "invoices"("series", "number");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Correlativos iniciales: facturas en 8 y boletas en 6.
INSERT INTO "invoice_counters" ("series", "next_number", "updated_at")
VALUES ('FFF1', 8, CURRENT_TIMESTAMP), ('BBB1', 6, CURRENT_TIMESTAMP)
ON CONFLICT ("series") DO NOTHING;
