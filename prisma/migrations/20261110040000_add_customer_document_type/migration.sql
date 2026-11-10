-- CreateEnum
CREATE TYPE "CustomerDocumentType" AS ENUM ('DNI', 'RUC');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "business_name" VARCHAR(160),
ADD COLUMN     "document_type" "CustomerDocumentType" NOT NULL DEFAULT 'DNI',
ADD COLUMN     "ruc" VARCHAR(11),
ALTER COLUMN "dni" DROP NOT NULL,
ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "last_name" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "customers_ruc_key" ON "customers"("ruc");
