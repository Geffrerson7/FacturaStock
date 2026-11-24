-- AlterTable
ALTER TABLE "products" ADD COLUMN "min_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "seller_id" TEXT;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN "list_price" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "sales_seller_id_idx" ON "sales"("seller_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
